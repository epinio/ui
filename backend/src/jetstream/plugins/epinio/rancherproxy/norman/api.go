package norman

import (
	"github.com/epinio/ui-backend/src/jetstream/plugins/epinio/rancherproxy/api"

	"github.com/epinio/ui-backend/src/jetstream/plugins/epinio/rancherproxy/interfaces"
	jInterfaces "github.com/epinio/ui-backend/src/jetstream/repository/interfaces"

	"github.com/labstack/echo/v4"
)

// Get the available auth providers
// /v3/authProviders
func GetAuthProviders(ec echo.Context, p jInterfaces.PortalProxy) error {
	col, err := NewAuthProviders(ec, p)

	if err != nil {
		return err
	}

	return api.SendResponse(ec, col)
}

// /v3/users
func GetUser(ec echo.Context) error {
	user := NewUser(interfaces.GetBaseURL(ec), ec.Get("user_id").(string))

	return api.SendResponse(ec, user)
}

// /v3/tokens
func TokenLogout(ec echo.Context, p jInterfaces.PortalProxy) error {
	ec.Response().Header().Set("X-Api-Cattle-Auth", "false")
	return p.GetStratosAuthService().Logout(ec)
}

// /v3/principals
func GetPrincipals(ec echo.Context) error {
	principal := NewPrincipal(interfaces.GetBaseURL(ec), ec.Get("user_id").(string))

	return api.SendResponse(ec, principal)
}

// /v3/schemas
func NormanSchemas(ec echo.Context) error {
	col := interfaces.Collection{
		Type:         interfaces.CollectionType,
		ResourceType: interfaces.SchemaType,
		Actions:      make(map[string]string),
		Links:        make(map[string]string),
		Revision:     "1",
	}

	col.Links["self"] = interfaces.GetSelfLink(ec)
	col.Data = make([]interface{}, 0)

	api.SendResponse(ec, col)

	return nil
}
