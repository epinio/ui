package userfavorites

import (
	"errors"

	"github.com/epinio/ui-backend/src/jetstream/plugins/userfavorites/userfavoritesstore"
	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
	"github.com/labstack/echo/v4"
)

// Module init will register plugin
func init() {
	interfaces.AddPlugin("userfavorites", nil, Init)
}

// UserFavorites stores user favorites
type UserFavorites struct {
	portalProxy interfaces.PortalProxy
}

// Init creates a new UserFavorites
func Init(portalProxy interfaces.PortalProxy) (interfaces.StratosPlugin, error) {
	userfavoritesstore.InitRepositoryProvider(portalProxy.GetConfig().DatabaseProviderName)
	return &UserFavorites{portalProxy: portalProxy}, nil
}

// GetMiddlewarePlugin gets the middleware plugin for this plugin
func (uf *UserFavorites) GetMiddlewarePlugin() (interfaces.MiddlewarePlugin, error) {
	return nil, errors.New("Not implemented")
}

// GetEndpointPlugin gets the endpoint plugin for this plugin
func (uf *UserFavorites) GetEndpointPlugin() (interfaces.EndpointPlugin, error) {
	return nil, errors.New("Not implemented")
}

// GetRoutePlugin gets the route plugin for this plugin
func (uf *UserFavorites) GetRoutePlugin() (interfaces.RoutePlugin, error) {
	return uf, nil
}

// GetMiddlewarePlugin gets the middleware plugin for this plugin
func (uf *UserFavorites) AddRootGroupRoutes(echoGroup *echo.Group) {
	// no-op
}

// AddAdminGroupRoutes adds the admin routes for this plugin to the Echo server
func (uf *UserFavorites) AddAdminGroupRoutes(echoGroup *echo.Group) {
	// no-op
}

// AddSessionGroupRoutes adds the session routes for this plugin to the Echo server
func (uf *UserFavorites) AddSessionGroupRoutes(echoGroup *echo.Group) {

	// Add REST API for User Favorites
	echoGroup.GET("/favorites", uf.getAll)
	echoGroup.DELETE("/favorites/:guid", uf.delete)
	echoGroup.POST("/favorites", uf.create)
	echoGroup.POST("/favorites/:guid/metadata", uf.setMetadata)
}

// Init performs plugin initialization
func (uf *UserFavorites) Init() error {
	return nil
}
