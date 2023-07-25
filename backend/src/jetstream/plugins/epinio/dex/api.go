package epiniodex

import (
	"net/http"

	"github.com/epinio/ui-backend/src/jetstream/plugins/epinio/rancherproxy/api"

	jInterfaces "github.com/epinio/ui-backend/src/jetstream/repository/interfaces"

	"github.com/labstack/echo/v4"
)

type RedirectUrlResponse struct {
	RedirectUrl string `json:"redirectUrl"`
}

func RedirectUrl(ec echo.Context, p jInterfaces.PortalProxy) error {
	oidcProvider, err := p.GetDex()

	if err != nil {
		return jInterfaces.NewHTTPShadowError(
			http.StatusInternalServerError,
			"Failed to create Dex Client",
			"Failed to create Dex Client: %+v",
			err,
		)
	}

	state := ec.QueryParams().Get("state")
	if len(state) == 0 {
		return jInterfaces.NewHTTPShadowError(
			http.StatusInternalServerError,
			"Invalid request, `state` required",
			"Invalid request, `state` required",
		)
	}

	dexUrl, _ := oidcProvider.AuthCodeURLWithPKCE(state)

	return api.SendResponse(ec, RedirectUrlResponse{
		RedirectUrl: dexUrl,
	})
}
