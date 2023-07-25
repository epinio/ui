package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
	log "github.com/sirupsen/logrus"
	"golang.org/x/net/context"
	"golang.org/x/oauth2"
)

func (p *portalProxy) DoDexFlowRequest(cnsiRequest *interfaces.CNSIRequest, req *http.Request) (*http.Response, error) {
	log.Debug("DoDexFlowRequest")

	authHandler := p.OAuthHandlerFunc(cnsiRequest, req, func(skipSSLValidation bool, cnsiGUID, userGUID, client, clientSecret, tokenEndpoint string) (t interfaces.TokenRecord, err error) {
		return p.RefreshDexToken(req.Context(), skipSSLValidation, cnsiGUID, userGUID, client, clientSecret, tokenEndpoint)
	})

	return p.DoAuthFlowRequest(cnsiRequest, req, authHandler)
}

func (p *portalProxy) RefreshDexToken(ctx context.Context, skipSSLValidation bool, cnsiGUID, userGUID, client, clientSecret, tokenEndpoint string) (t interfaces.TokenRecord, err error) {
	log.Debug("RefreshDexToken")

	userToken, ok := p.GetCNSITokenRecordWithDisconnected(cnsiGUID, userGUID)
	if !ok {
		return t, fmt.Errorf("info could not be found for user with GUID %s", userGUID)
	}

	oidcProvider, err := p.GetDex()
	if err != nil {
		return t, fmt.Errorf("failed to get dex client: %+v", err)
	}

	// Convert out token into oauth2 token
	oathToken := &oauth2.Token{
		AccessToken:  userToken.AuthToken,
		TokenType:    "Bearer",
		RefreshToken: userToken.RefreshToken,
		Expiry:       time.Unix(userToken.TokenExpiry, 0),
	}

	// Get new token (we could dump OAuthHandlerFunc above and just use this plus `Request` part)
	tokenSource := oidcProvider.GetConfig().TokenSource(ctx, oathToken)
	newOathToken, err := tokenSource.Token()
	if err != nil {
		return t, fmt.Errorf("failed to fetch refreshed token: %+v", err)
	}

	tokenRecord := &interfaces.TokenRecord{
		AuthType:     interfaces.AuthTypeDex,
		AuthToken:    newOathToken.AccessToken,
		RefreshToken: newOathToken.RefreshToken,
		TokenExpiry:  newOathToken.Expiry.Unix(),
		Metadata:     userToken.Metadata, // This will be used for refreshing the token
	}

	err = p.setCNSITokenRecord(cnsiGUID, userGUID, *tokenRecord)
	if err != nil {
		return t, fmt.Errorf("couldn't save new token: %v", err)
	}

	return *tokenRecord, nil
}
