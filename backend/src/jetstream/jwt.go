package main

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"

	log "github.com/sirupsen/logrus"

	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
)

func (p *portalProxy) GetUserTokenInfo(tok string) (u *interfaces.JWTUserTokenInfo, err error) {
	log.Debug("getUserTokenInfo")
	accessToken := strings.TrimPrefix(tok, "bearer ")
	splits := strings.Split(accessToken, ".")

	if len(splits) < 3 {
		return u, errors.New("Token was poorly formed.")
	}

	decoded, err := base64.RawStdEncoding.DecodeString(splits[1])
	if err != nil {
		return u, errors.New("Unable to decode token string.")
	}

	if err = json.Unmarshal(decoded, &u); err != nil {
		return u, errors.New("Failed to unmarshall decoded token.")
	}

	return u, err
}
