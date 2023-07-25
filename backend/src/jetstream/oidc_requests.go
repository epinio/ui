package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
	log "github.com/sirupsen/logrus"
)

func (p *portalProxy) DoOidcFlowRequest(cnsiRequest *interfaces.CNSIRequest, req *http.Request) (*http.Response, error) {
	log.Debug("DoOidcFlowRequest")

	authHandler := p.OAuthHandlerFunc(cnsiRequest, req, p.RefreshOidcToken)
	return p.DoAuthFlowRequest(cnsiRequest, req, authHandler)
}

func (p *portalProxy) RefreshOidcToken(skipSSLValidation bool, cnsiGUID, userGUID, client, clientSecret, tokenEndpoint string) (t interfaces.TokenRecord, err error) {
	log.Debug("RefreshOidcToken")
	userToken, ok := p.GetCNSITokenRecordWithDisconnected(cnsiGUID, userGUID)
	if !ok {
		return t, fmt.Errorf("Info could not be found for user with GUID %s", userGUID)
	}

	tokenEndpointWithPath := fmt.Sprintf("%s/oauth/token", tokenEndpoint)

	// Parse out token metadata is there is some, and override some of theser parameters

	var scopes string

	log.Info(userToken.Metadata)
	if len(userToken.Metadata) > 0 {
		metadata := &interfaces.OAuth2Metadata{}
		if err := json.Unmarshal([]byte(userToken.Metadata), metadata); err == nil {
			log.Info(metadata)
			log.Info(metadata.ClientID)
			log.Info(metadata.ClientSecret)

			if len(metadata.ClientID) > 0 {
				client = metadata.ClientID
			}
			if len(metadata.ClientSecret) > 0 {
				clientSecret = metadata.ClientSecret
			}
			if len(metadata.IssuerURL) > 0 {
				tokenEndpoint = metadata.IssuerURL
				tokenEndpointWithPath = fmt.Sprintf("%s/token", tokenEndpoint)
			}
		}
	}

	uaaRes, err := p.getUAATokenWithRefreshToken(skipSSLValidation, userToken.RefreshToken, client, clientSecret, tokenEndpointWithPath, scopes)
	if err != nil {
		return t, fmt.Errorf("Token refresh request failed: %v", err)
	}

	u, err := p.GetUserTokenInfo(uaaRes.IDToken)
	if err != nil {
		return t, fmt.Errorf("Could not get user token info from id token")
	}

	u.UserGUID = userGUID

	tokenRecord := p.InitEndpointTokenRecord(u.TokenExpiry, uaaRes.AccessToken, uaaRes.RefreshToken, userToken.Disconnected)
	tokenRecord.AuthType = interfaces.AuthTypeOIDC
	// Copy across the metadata from the original token
	tokenRecord.Metadata = userToken.Metadata

	err = p.setCNSITokenRecord(cnsiGUID, userGUID, tokenRecord)
	if err != nil {
		return t, fmt.Errorf("Couldn't save new token: %v", err)
	}

	return tokenRecord, nil
}
