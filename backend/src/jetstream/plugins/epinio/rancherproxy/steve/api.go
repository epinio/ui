package steve

import (
	"github.com/epinio/ui-backend/src/jetstream/plugins/epinio/rancherproxy/api"

	"github.com/labstack/echo/v4"
)

// Fetch settings
// /v1/management.cattle.io.setting
func MgmtSettings(ec echo.Context) error {

	col := NewDefaultSettings(ec)

	return api.SendResponse(ec, col)
}

// /v1/management.cattle.io.cluster
func Clusters(ec echo.Context) error {
	col := NewClusters(ec)

	return api.SendResponse(ec, col)
}

// /v1/schemas
func SteveSchemas(ec echo.Context) error {

	col := NewDefaultSchemas(ec)

	return api.SendResponse(ec, col)
}
