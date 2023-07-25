package main

import (
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"math"
	"net/http"

	log "github.com/sirupsen/logrus"

	"github.com/labstack/echo/v4"

	"github.com/epinio/ui-backend/src/jetstream/plugins/epinio/rancherproxy"
	epinio_utils "github.com/epinio/ui-backend/src/jetstream/plugins/epinio/utils"

	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
)

// More fields will be moved into here as global portalProxy struct is phased out
type epinioAuth struct {
	databaseConnectionPool *sql.DB
	p                      *portalProxy
}

func (a *epinioAuth) ShowConfig(config *interfaces.ConsoleConfig) {
	log.Infof("... Epinio Auth             : %v", true)
}

// Login provides Local-auth specific Stratos login
func (a *epinioAuth) Login(c echo.Context) error {

	//This check will remain in until auth is factored down into its own package
	if interfaces.AuthEndpointTypes[a.p.Config.ConsoleConfig.AuthEndpointType] != interfaces.Epinio {
		err := interfaces.NewHTTPShadowError(
			http.StatusNotFound,
			"Epinio Login is not enabled",
			"Epinio Login is not enabled")
		return err
	}

	authType := c.Get("auth_type").(string)

	var userGUID, username string
	var err error

	switch authType {
	case "local":
		userGUID, username, err = a.epinioLocalLogin(c)
	case "oidc":
		userGUID, username, err = a.epinioOIDCLogin(c)
	}

	// Perform the login and fetch session values if successful

	if err != nil {
		//Login failed, return response.
		resp := &rancherproxy.LoginErrorRes{
			Type:      "error",
			BasetType: "error",
			Code:      "Unauthorized",
			Status:    http.StatusUnauthorized,
			Message:   err.Error(),
		}

		if jsonString, err := json.Marshal(resp); err == nil {
			c.Response().Status = http.StatusUnauthorized
			c.Response().Header().Set("Content-Type", "application/json")
			c.Response().Write(jsonString)
		}

		return nil
	}

	err = a.generateLoginSuccessResponse(c, userGUID, username)

	return err
}

// Logout provides Local-auth specific Stratos login
func (a *epinioAuth) Logout(c echo.Context) error {
	log.Debug("Logout")
	return a.logout(c)
}

// GetUsername gets the user name for the specified local user
func (a *epinioAuth) GetUsername(userid string) (string, error) {
	log.Debug("GetUsername")

	return userid, nil // username == user guid
}

// GetUser gets the user guid for the specified local user
func (a *epinioAuth) GetUser(userGUID string) (*interfaces.ConnectedUser, error) {
	log.Debug("GetUser")

	scopes := make([]string, 0) // User has no stratos scopes such as "stratos.admin", "password.write", "scim.write"

	connectedUser := &interfaces.ConnectedUser{
		GUID:   userGUID,
		Name:   userGUID,
		Admin:  false,
		Scopes: scopes,
	}

	return connectedUser, nil
}

func (a *epinioAuth) BeforeVerifySession(c echo.Context) {}

func (a *epinioAuth) VerifySession(c echo.Context, sessionUser string, sessionExpireTime int64) error {
	// Never expires
	// Only used by `/v1/auth/verify`
	return nil
}

// epinioLocalLogin verifies local user credentials
func (a *epinioAuth) epinioLocalLogin(c echo.Context) (string, string, error) {
	log.Debug("epinioLocalLogin")

	username, password, err := a.getRancherUsernameAndPassword(c)
	if err != nil {
		msg := "unable to determine Username and/or password: %+v"
		log.Errorf(msg, err)
		return "", "", errors.New(msg)
	}

	if err := a.verifyLocalLoginCreds(username, password); err != nil {
		msg := "unable to verify Username and/or password: %+v"
		log.Errorf(msg, err)
		return "", "", errors.New(msg)
	}

	// User guid, user name, err
	return username, username, nil
}

func (a *epinioAuth) getRancherUsernameAndPassword(c echo.Context) (string, string, error) {
	defer c.Request().Body.Close()
	body, err := ioutil.ReadAll(c.Request().Body)
	if err != nil {
		return "", "", err
	}

	var params rancherproxy.LoginParams
	if err = json.Unmarshal(body, &params); err != nil {
		return "", "", errors.New("failed to parse body with username/password")
	}

	username := params.Username
	password := params.Password

	if len(username) == 0 || len(password) == 0 {
		return "", username, errors.New("username and/or password required")
	}

	authString := fmt.Sprintf("%s:%s", username, password)
	base64EncodedAuthString := base64.StdEncoding.EncodeToString([]byte(authString))

	// Set these so they're available in the epinio plugin login
	tr := &interfaces.TokenRecord{
		AuthType:     interfaces.AuthTypeHttpBasic,
		AuthToken:    base64EncodedAuthString,
		RefreshToken: username,
	}
	c.Set("token", tr)

	return username, password, nil
}

func (a *epinioAuth) verifyLocalLoginCreds(username, password string) error {
	log.Debug("verifyEpinioCreds")

	// Find the epinio endpoint
	epinioEndpoint, err := epinio_utils.FindEpinioEndpoint(a.p)

	if err != nil {
		return fmt.Errorf("failed to find an epinio endpoint: %v", err)
	}

	// Make a request to the epinio endpoint that requires auth
	credsUrl := fmt.Sprintf("%s/api/v1/info", epinioEndpoint.APIEndpoint.String())

	req, err := http.NewRequest("GET", credsUrl, nil)
	if err != nil {
		return fmt.Errorf("failed to create request to verify epinio creds: %v", err)
	}

	req.SetBasicAuth(username, password)

	var h = a.p.GetHttpClientForRequest(req, epinioEndpoint.SkipSSLValidation)
	res, err := h.Do(req)
	if err != nil || res.StatusCode != http.StatusOK {
		log.Errorf("Error verify epinio creds - response: %v, error: %v", res, err)
		return interfaces.LogHTTPError(res, err)
	}

	defer res.Body.Close()

	return nil

}

// ------------------
// epinioOIDCLogin verifies DEX credentials
func (a *epinioAuth) epinioOIDCLogin(c echo.Context) (string, string, error) {
	log.Debug("epinioOIDCLogin")

	defer c.Request().Body.Close()
	body, err := ioutil.ReadAll(c.Request().Body)
	if err != nil {
		msg := "unable to read body: %+v"
		log.Errorf(msg, err)
		return "", "", errors.New(msg)
	}

	var params rancherproxy.LoginOIDCParams
	if err = json.Unmarshal(body, &params); err != nil {
		msg := "unable to parse body: %+v"
		log.Errorf(msg, err)
		return "", "", errors.New(msg)
	}

	if len(params.Code) == 0 {
		return "", "", errors.New("auth code required")
	}

	oidcProvider, err := a.p.GetDex()

	if err != nil {
		msg := fmt.Sprintf("unable to create dex client: %+v", err)
		log.Error(msg)
		return "", "", errors.New(msg)
	}

	token, err := oidcProvider.ExchangeWithPKCE(c.Request().Context(), params.Code, params.CodeVerifier)
	if err != nil {
		msg := fmt.Sprintf("failed to get token from code: %+v", err)
		log.Errorf(msg)
		return "", "", errors.New(msg)
	}

	tr := &interfaces.TokenRecord{
		AuthType:     interfaces.AuthTypeDex,
		AuthToken:    token.AccessToken,
		RefreshToken: token.RefreshToken,
		TokenExpiry:  token.Expiry.Unix(),
		Metadata:     params.CodeVerifier, // This will be used for refreshing the token
	}

	idToken, err := oidcProvider.Verify(c.Request().Context(), token.AccessToken)
	if err != nil {
		msg := "failed to verify fetched token: %+v"
		log.Errorf(msg, err)
		return "", "", errors.New(msg)
	}

	var claims struct {
		Email           string   `json:"email"`
		Groups          []string `json:"groups"`
		FederatedClaims struct {
			ConnectorID string `json:"connector_id"`
		} `json:"federated_claims"`
	}
	log.Warnf("epinioOIDCLogin: token: %+v", idToken)

	if err := idToken.Claims(&claims); err != nil {
		msg := "token in unexpected format"
		log.Errorf(msg, err)
		return "", "", errors.New(msg)
	}

	log.Warnf("epinioOIDCLogin: claims: %+v", claims)

	c.Set("token", tr)

	return claims.Email, claims.Email, nil

}

// ------------------
// generateLoginSuccessResponse
func (e *epinioAuth) generateLoginSuccessResponse(c echo.Context, userGUID, username string) error {
	log.Debug("generateLoginSuccessResponse")

	var err error
	var expiry int64 = math.MaxInt64 // Basic auth type never expires

	sessionValues := make(map[string]interface{})
	sessionValues["user_id"] = userGUID
	sessionValues["exp"] = expiry

	// Ensure that login disregards cookies from the request
	req := c.Request()
	req.Header.Set("Cookie", "")
	if err = e.p.setSessionValues(c, sessionValues); err != nil {
		return err
	}

	//Makes sure the client gets the right session expiry time
	if err = e.p.handleSessionExpiryHeader(c); err != nil {
		return err
	}

	// This will register and log the user in to the sole epinio instance. It should really move to here
	err = e.p.ExecuteLoginHooks(c)
	if err != nil {
		log.Warnf("Login hooks failed: %v", err)
	}

	resp := &interfaces.LoginRes{
		Account:     username,
		TokenExpiry: expiry,
		APIEndpoint: nil,
		Admin:       false,
	}

	if jsonString, err := json.Marshal(resp); err == nil {
		// Add XSRF Token
		e.p.ensureXSRFToken(c)

		// Swap Stratos's cross-site request forgery token for Rancher
		cookie := new(http.Cookie)
		cookie.Name = "CSRF" // This matches Rancher's cookie name for the token
		cookie.Value = c.Response().Header().Get(interfaces.XSRFTokenHeader)
		cookie.Domain = e.p.SessionStoreOptions.Domain
		cookie.Secure = e.p.SessionStoreOptions.Secure
		cookie.Path = e.p.SessionStoreOptions.Path
		cookie.MaxAge = 0
		c.SetCookie(cookie)

		c.Response().Header().Set("Content-Type", "application/json")
		c.Response().Write(jsonString)
	}

	return err
}

// logout
func (a *epinioAuth) logout(c echo.Context) error {
	a.p.removeEmptyCookie(c)

	// Remove the XSRF Token from the session
	err := a.p.unsetSessionValue(c, XSRFTokenSessionName)
	if err != nil {
		log.Errorf("Unable to unset session value: %v", err)
	}

	err = a.p.clearSession(c)
	if err != nil {
		log.Errorf("Unable to clear session: %v", err)
	}

	err = a.p.ExecuteLogoutHooks(c)
	if err != nil {
		log.Warnf("Logout hooks failed: %v", err)
	}

	// Send JSON document
	resp := &LogoutResponse{
		IsSSO: a.p.Config.SSOLogin,
	}

	return c.JSON(http.StatusOK, resp)
}
