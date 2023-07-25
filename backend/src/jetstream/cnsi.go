package main

import (
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/labstack/echo/v4"
	log "github.com/sirupsen/logrus"

	"crypto/sha1"
	"encoding/base64"

	"github.com/epinio/ui-backend/src/jetstream/plugins/userfavorites/userfavoritesendpoints"
	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
)

const dbReferenceError = "Unable to establish a database reference: '%v'"

func isSSLRelatedError(err error) (bool, string) {
	if urlErr, ok := err.(*url.Error); ok {
		if x509Err, ok := urlErr.Err.(x509.UnknownAuthorityError); ok {
			return true, x509Err.Error()
		}
		if x509Err, ok := urlErr.Err.(x509.HostnameError); ok {
			return true, x509Err.Error()
		}
		if x509Err, ok := urlErr.Err.(x509.CertificateInvalidError); ok {
			return true, x509Err.Error()
		}
	}
	return false, ""
}

func (p *portalProxy) RegisterEndpoint(c echo.Context, fetchInfo interfaces.InfoFunc) error {
	log.Debug("registerEndpoint")

	params := new(interfaces.RegisterEndpointParams)
	err := interfaces.BindOnce(params, c)
	if err != nil {
		return err
	}

	skipSSLValidation, err := strconv.ParseBool(params.SkipSSLValidation)
	if err != nil {
		log.Errorf("Failed to parse skip_ssl_validation value: %s", err)
		// default to false
		skipSSLValidation = false
	}

	ssoAllowed, err := strconv.ParseBool(params.SSOAllowed)
	if err != nil {
		// default to false
		ssoAllowed = false
	}

	cnsiClientId := params.CNSIClientID
	cnsiClientSecret := params.CNSIClientSecret
	subType := params.SubType

	if cnsiClientId == "" {
		cnsiClientId = p.GetConfig().CFClient
		cnsiClientSecret = p.GetConfig().CFClientSecret
	}

	newCNSI, err := p.DoRegisterEndpoint(params.CNSIName, params.APIEndpoint, skipSSLValidation, cnsiClientId, cnsiClientSecret, ssoAllowed, subType, fetchInfo)
	if err != nil {
		return err
	}

	c.JSON(http.StatusCreated, newCNSI)
	return nil
}

func (p *portalProxy) DoRegisterEndpoint(cnsiName string, apiEndpoint string, skipSSLValidation bool, clientId string, clientSecret string, ssoAllowed bool, subType string, fetchInfo interfaces.InfoFunc) (interfaces.CNSIRecord, error) {

	if len(cnsiName) == 0 || len(apiEndpoint) == 0 {
		return interfaces.CNSIRecord{}, interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Needs CNSI Name and API Endpoint",
			"CNSI Name or Endpoint were not provided when trying to register an CF Cluster")
	}

	apiEndpoint = strings.TrimRight(apiEndpoint, "/")

	// Remove trailing slash, if there is one
	apiEndpointURL, err := url.Parse(apiEndpoint)
	if err != nil {
		return interfaces.CNSIRecord{}, interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Failed to get API Endpoint",
			"Failed to get API Endpoint: %v", err)
	}

	// check if we've already got this endpoint in the DB
	ok := p.cnsiRecordExists(apiEndpoint)
	if ok {
		// a record with the same api endpoint was found
		return interfaces.CNSIRecord{}, interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Can not register same endpoint multiple times",
			"Can not register same endpoint multiple times",
		)
	}

	newCNSI, _, err := fetchInfo(apiEndpoint, skipSSLValidation)
	if err != nil {
		if ok, detail := isSSLRelatedError(err); ok {
			return interfaces.CNSIRecord{}, interfaces.NewHTTPShadowError(
				http.StatusForbidden,
				"SSL error - "+detail,
				"There is a problem with the server Certificate - %s",
				detail)
		}
		return interfaces.CNSIRecord{}, interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Failed to validate endpoint",
			"Failed to validate endpoint: %v",
			err)
	}

	h := sha1.New()
	h.Write([]byte(apiEndpointURL.String()))
	guid := base64.RawURLEncoding.EncodeToString(h.Sum(nil))

	newCNSI.Name = cnsiName
	newCNSI.APIEndpoint = apiEndpointURL
	newCNSI.SkipSSLValidation = skipSSLValidation
	newCNSI.ClientId = clientId
	newCNSI.ClientSecret = clientSecret
	newCNSI.SSOAllowed = ssoAllowed
	newCNSI.SubType = subType

	err = p.setCNSIRecord(guid, newCNSI)

	// set the guid on the object so it's returned in the response
	newCNSI.GUID = guid

	// Notify plugins if they support the notification interface
	for _, plugin := range p.Plugins {
		if notifier, ok := plugin.(interfaces.EndpointNotificationPlugin); ok {
			notifier.OnEndpointNotification(interfaces.EndpointRegisterAction, &newCNSI)
		}
	}

	return newCNSI, err
}

// unregisterCluster godoc
// @Summary Unregister endpoint
// @Description
// @Tags admin
// @Accept	x-www-form-urlencoded
// @Produce	json
// @Param id path string true "Endpoint GUID"
// @Success 200
// @Failure 400 {object} interfaces.ErrorResponseBody "Error response"
// @Failure 401 {object} interfaces.ErrorResponseBody "Error response"
// @Security ApiKeyAuth
// @Router /endpoints/{id} [delete]
// TODO (wchrisjohnson) We need do this as a TRANSACTION, vs a set of single calls
func (p *portalProxy) unregisterCluster(c echo.Context) error {
	cnsiGUID := c.Param("id")
	log.WithField("cnsiGUID", cnsiGUID).Debug("unregisterCluster")

	if len(cnsiGUID) == 0 {
		return interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Missing target endpoint",
			"Need CNSI GUID passed as form param")
	}
	// Should check for errors?
	p.unsetCNSIRecord(cnsiGUID)

	p.unsetCNSITokenRecords(cnsiGUID)

	ufe := userfavoritesendpoints.Constructor(p, cnsiGUID)
	ufe.RemoveFavorites()

	return nil
}

func (p *portalProxy) buildCNSIList(c echo.Context) ([]*interfaces.CNSIRecord, error) {
	log.Debug("buildCNSIList")
	return p.ListEndpoints()
}

func (p *portalProxy) ListEndpoints() ([]*interfaces.CNSIRecord, error) {
	log.Debug("ListEndpoints")
	var cnsiList []*interfaces.CNSIRecord
	var err error

	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		return cnsiList, fmt.Errorf("listRegisteredCNSIs: %s", err)
	}

	cnsiList, err = cnsiRepo.List(p.Config.EncryptionKeyInBytes)
	if err != nil {
		return cnsiList, err
	}

	return cnsiList, nil
}

// listCNSIs godoc
// @Summary List endpoints
// @Description
// @Accept	x-www-form-urlencoded
// @Produce	json
// @Success 200 {array}  interfaces.CNSIRecord "List of endpoints"
// @Failure 400 {object} interfaces.ErrorResponseBody "Error response"
// @Failure 401 {object} interfaces.ErrorResponseBody "Error response"
// @Security ApiKeyAuth
// @Router /endpoints [get]
func (p *portalProxy) listCNSIs(c echo.Context) error {
	log.Debug("listCNSIs")
	cnsiList, err := p.buildCNSIList(c)
	if err != nil {
		return interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Failed to retrieve list of CNSIs",
			"Failed to retrieve list of CNSIs: %v", err,
		)
	}

	jsonString, err := marshalCNSIlist(cnsiList)
	if err != nil {
		return err
	}

	c.Response().Header().Set("Content-Type", "application/json")
	c.Response().Write(jsonString)
	return nil
}

func (p *portalProxy) listRegisteredCNSIs(c echo.Context) error {
	log.Debug("listRegisteredCNSIs")
	userGUIDIntf, err := p.GetSessionValue(c, "user_id")
	if err != nil {
		return interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"User session could not be found",
			"User session could not be found: %v", err,
		)
	}
	userGUID := userGUIDIntf.(string)

	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		return fmt.Errorf("listRegisteredCNSIs: %s", err)
	}

	var jsonString []byte
	var clusterList []*interfaces.ConnectedEndpoint

	clusterList, err = cnsiRepo.ListByUser(userGUID)
	if err != nil {
		return interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Failed to retrieve list of clusters",
			"Failed to retrieve list of clusters: %v", err,
		)
	}

	jsonString, err = marshalClusterList(clusterList)
	if err != nil {
		return err
	}

	c.Response().Header().Set("Content-Type", "application/json")
	c.Response().Write(jsonString)
	return nil
}

func marshalCNSIlist(cnsiList []*interfaces.CNSIRecord) ([]byte, error) {
	log.Debug("marshalCNSIlist")
	jsonString, err := json.Marshal(cnsiList)
	if err != nil {
		return nil, interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Failed to retrieve list of CNSIs",
			"Failed to retrieve list of CNSIs: %v", err,
		)
	}
	return jsonString, nil
}

func marshalClusterList(clusterList []*interfaces.ConnectedEndpoint) ([]byte, error) {
	log.Debug("marshalClusterList")
	jsonString, err := json.Marshal(clusterList)
	if err != nil {
		return nil, interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Failed to retrieve list of clusters",
			"Failed to retrieve list of clusters: %v", err,
		)
	}
	return jsonString, nil
}

func (p *portalProxy) UpdateEndpointMetadata(guid string, metadata string) error {
	log.Debug("UpdateEndpointMetadata")

	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		log.Errorf(dbReferenceError, err)
		return fmt.Errorf(dbReferenceError, err)
	}

	err = cnsiRepo.UpdateMetadata(guid, metadata)
	if err != nil {
		msg := "Unable to update endpoint metadata: %v"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	return nil
}

func (p *portalProxy) GetCNSIRecord(guid string) (interfaces.CNSIRecord, error) {
	log.Debug("GetCNSIRecord")
	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		return interfaces.CNSIRecord{}, err
	}

	rec, err := cnsiRepo.Find(guid, p.Config.EncryptionKeyInBytes)
	if err != nil {
		return interfaces.CNSIRecord{}, err
	}

	// Ensure that trailing slash is removed from the API Endpoint
	rec.APIEndpoint.Path = strings.TrimRight(rec.APIEndpoint.Path, "/")

	return rec, nil
}

func (p *portalProxy) GetCNSIRecordByEndpoint(endpoint string) (interfaces.CNSIRecord, error) {
	log.Debug("GetCNSIRecordByEndpoint")
	var rec interfaces.CNSIRecord

	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		return rec, err
	}

	rec, err = cnsiRepo.FindByAPIEndpoint(endpoint, p.Config.EncryptionKeyInBytes)
	if err != nil {
		return rec, err
	}

	// Ensure that trailing slash is removed from the API Endpoint
	rec.APIEndpoint.Path = strings.TrimRight(rec.APIEndpoint.Path, "/")

	return rec, nil
}

func (p *portalProxy) cnsiRecordExists(endpoint string) bool {
	log.Debug("cnsiRecordExists")

	_, err := p.GetCNSIRecordByEndpoint(endpoint)
	return err == nil
}

func (p *portalProxy) setCNSIRecord(guid string, c interfaces.CNSIRecord) error {
	log.Debug("setCNSIRecord")
	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		log.Errorf(dbReferenceError, err)
		return fmt.Errorf(dbReferenceError, err)
	}

	err = cnsiRepo.Save(guid, c, p.Config.EncryptionKeyInBytes)
	if err != nil {
		msg := "Unable to save a CNSI Token: %v"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	return nil
}

func (p *portalProxy) unsetCNSIRecord(guid string) error {
	log.Debug("unsetCNSIRecord")
	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		log.Errorf(dbReferenceError, err)
		return fmt.Errorf(dbReferenceError, err)
	}

	// Lookup the endpoint, so can pass the information to the plugins
	endpoint, lookupErr := cnsiRepo.Find(guid, p.Config.EncryptionKeyInBytes)

	// Delete the endpoint
	err = cnsiRepo.Delete(guid)
	if err != nil {
		msg := "Unable to delete a CNSI record: %v"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	if lookupErr == nil {
		// Notify plugins if they support the notification interface
		for _, plugin := range p.Plugins {
			if notifier, ok := plugin.(interfaces.EndpointNotificationPlugin); ok {
				notifier.OnEndpointNotification(interfaces.EndpointUnregisterAction, &endpoint)
			}
		}
	}

	return nil
}

func (p *portalProxy) SaveEndpointToken(cnsiGUID string, userGUID string, tokenRecord interfaces.TokenRecord) error {
	log.Debug("SaveEndpointToken")
	tokenRepo, err := p.GetStoreFactory().TokenStore()
	if err != nil {
		return err
	}

	return tokenRepo.SaveCNSIToken(cnsiGUID, userGUID, tokenRecord, p.Config.EncryptionKeyInBytes)
}

func (p *portalProxy) DeleteEndpointToken(cnsiGUID string, userGUID string) error {
	log.Debug("DeleteEndpointToken")
	tokenRepo, err := p.GetStoreFactory().TokenStore()
	if err != nil {
		return err
	}

	return tokenRepo.DeleteCNSIToken(cnsiGUID, userGUID)
}

func (p *portalProxy) GetCNSITokenRecord(cnsiGUID string, userGUID string) (interfaces.TokenRecord, bool) {
	log.Debug("GetCNSITokenRecord")
	tokenRepo, err := p.GetStoreFactory().TokenStore()
	if err != nil {
		return interfaces.TokenRecord{}, false
	}

	tr, err := tokenRepo.FindCNSIToken(cnsiGUID, userGUID, p.Config.EncryptionKeyInBytes)
	if err != nil {
		return interfaces.TokenRecord{}, false
	}

	return tr, true
}

func (p *portalProxy) GetCNSITokenRecordWithDisconnected(cnsiGUID string, userGUID string) (interfaces.TokenRecord, bool) {
	log.Debug("GetCNSITokenRecordWithDisconnected")
	tokenRepo, err := p.GetStoreFactory().TokenStore()
	if err != nil {
		return interfaces.TokenRecord{}, false
	}

	tr, err := tokenRepo.FindCNSITokenIncludeDisconnected(cnsiGUID, userGUID, p.Config.EncryptionKeyInBytes)
	if err != nil {
		return interfaces.TokenRecord{}, false
	}

	return tr, true
}

func (p *portalProxy) ListEndpointsByUser(userGUID string) ([]*interfaces.ConnectedEndpoint, error) {
	log.Debug("ListCEndpointsByUser")
	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		log.Errorf(dbReferenceError, err)
		return nil, fmt.Errorf(dbReferenceError, err)
	}

	cnsiList, err := cnsiRepo.ListByUser(userGUID)
	if err != nil {
		log.Debugf("Error was: %+v", err)
		return nil, err
	}

	return cnsiList, nil
}

// Uopdate the Access Token, Refresh Token and Token Expiry for a token
func (p *portalProxy) updateTokenAuth(userGUID string, t interfaces.TokenRecord) error {
	log.Debug("updateTokenAuth")
	tokenRepo, err := p.GetStoreFactory().TokenStore()
	if err != nil {
		log.Errorf(dbReferenceError, err)
		return fmt.Errorf(dbReferenceError, err)
	}

	err = tokenRepo.UpdateTokenAuth(userGUID, t, p.Config.EncryptionKeyInBytes)
	if err != nil {
		msg := "Unable to update Token: %v"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	return nil
}

func (p *portalProxy) setCNSITokenRecord(cnsiGUID string, userGUID string, t interfaces.TokenRecord) error {
	log.Debug("setCNSITokenRecord")
	tokenRepo, err := p.GetStoreFactory().TokenStore()
	if err != nil {
		log.Errorf(dbReferenceError, err)
		return fmt.Errorf(dbReferenceError, err)
	}

	err = tokenRepo.SaveCNSIToken(cnsiGUID, userGUID, t, p.Config.EncryptionKeyInBytes)
	if err != nil {
		msg := "Unable to save a CNSI Token: %v"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	return nil
}

func (p *portalProxy) unsetCNSITokenRecord(cnsiGUID string, userGUID string) error {
	log.Debug("unsetCNSITokenRecord")
	tokenRepo, err := p.GetStoreFactory().TokenStore()
	if err != nil {
		msg := "Unable to establish a database reference: '%v'"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	err = tokenRepo.DeleteCNSIToken(cnsiGUID, userGUID)
	if err != nil {
		msg := "Unable to delete a CNSI Token: %v"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	return nil
}

func (p *portalProxy) unsetCNSITokenRecords(cnsiGUID string) error {
	log.Debug("unsetCNSITokenRecord")
	tokenRepo, err := p.GetStoreFactory().TokenStore()
	if err != nil {
		msg := "Unable to establish a database reference: '%v'"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	err = tokenRepo.DeleteCNSITokens(cnsiGUID)
	if err != nil {
		msg := "Unable to delete a CNSI Token: %v"
		log.Errorf(msg, err)
		return fmt.Errorf(msg, err)
	}

	return nil
}

// updateEndpoint godoc
// @Summary Edit endpoint
// @Description
// @Tags admin
// @Accept	x-www-form-urlencoded
// @Produce	json
// @Param id path string true "Endpoint GUID"
// @Param name formData string true "Endpoint name"
// @Param skipSSL formData string false "Skip SSL" Enums(true, false)
// @Param setClientInfo formData string false "Set client info" Enums(true, false)
// @Param clientID formData string false "Client ID"
// @Param clientSecret formData string false "Client secret"
// @Param allowSSO formData string false "Allow SSO" Enums(true, false)
// @Success 200
// @Failure 400 {object} interfaces.ErrorResponseBody "Error response"
// @Failure 401 {object} interfaces.ErrorResponseBody "Error response"
// @Security ApiKeyAuth
// @Router /endpoints/{id} [post]
func (p *portalProxy) updateEndpoint(ec echo.Context) error {
	log.Debug("updateEndpoint")

	params := new(interfaces.UpdateEndpointParams)
	if err := ec.Bind(params); err != nil {
		return err
	}

	// Check we have an ID
	if len(params.ID) == 0 {
		return interfaces.NewHTTPShadowError(
			http.StatusBadRequest,
			"Missing target endpoint",
			"Need Endpoint ID")
	}

	cnsiRepo, err := p.GetStoreFactory().EndpointStore()
	if err != nil {
		log.Errorf(dbReferenceError, err)
		return fmt.Errorf(dbReferenceError, err)
	}

	endpoint, err := cnsiRepo.Find(params.ID, p.Config.EncryptionKeyInBytes)
	if err != nil {
		return fmt.Errorf("Could not find the endpoint %s: '%v'", params.ID, err)
	}

	updates := false

	// Update name
	name := params.Name
	if len(name) > 0 {
		endpoint.Name = name
		updates = true
	}

	// Skip SSL validation
	skipSSL := params.SkipSSL
	if len(skipSSL) > 0 {
		v, err := strconv.ParseBool(skipSSL)
		if err == nil {
			if v != endpoint.SkipSSLValidation {
				// SSL Validation value changed
				endpoint.SkipSSLValidation = v
				updates = true
				if !v {
					// Skip SSL validation is OFF - so check we can communicate with the endpoint
					plugin, err := p.GetEndpointTypeSpec(endpoint.CNSIType)
					if err != nil {
						return fmt.Errorf("Can not get endpoint type for %s: '%v'", endpoint.CNSIType, err)
					}
					_, _, err = plugin.Info(endpoint.APIEndpoint.String(), endpoint.SkipSSLValidation)
					if err != nil {
						if ok, detail := isSSLRelatedError(err); ok {
							return interfaces.NewHTTPShadowError(
								http.StatusForbidden,
								"SSL error - "+detail,
								"There is a problem with the server Certificate - %s",
								detail)
						}
						return interfaces.NewHTTPShadowError(
							http.StatusBadRequest,
							fmt.Sprintf("Could not validate endpoint: %v", err),
							"Could not validate endpoint: %v",
							err)
					}
				}
			}
		}
	}

	// Client ID and Client Secret
	setClientInfo := params.SetClientInfo
	isSet, err := strconv.ParseBool(setClientInfo)
	if err == nil && isSet {
		clientID := params.ClientID
		clientSecret := params.ClientSecret
		endpoint.ClientId = clientID
		endpoint.ClientSecret = clientSecret
		updates = true
	}

	// Allow SSO
	allowSSO := params.AllowSSO
	if len(allowSSO) > 0 {
		v, err := strconv.ParseBool(allowSSO)
		if err == nil {
			if v != endpoint.SSOAllowed {
				// Allow SSO value changed
				endpoint.SSOAllowed = v
				updates = true
			}
		}
	}

	// Apply updates
	if updates {
		err := cnsiRepo.Update(endpoint, p.Config.EncryptionKeyInBytes)
		if err != nil {
			return fmt.Errorf("Could not update the endpoint %s: '%v'", params.ID, err)
		}
	}

	// Notify plugins if they support the notification interface
	for _, plugin := range p.Plugins {
		if notifier, ok := plugin.(interfaces.EndpointNotificationPlugin); ok {
			notifier.OnEndpointNotification(interfaces.EndpointUpdateAction, &endpoint)
		}
	}

	return nil
}
