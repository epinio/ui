package interfaces

import "github.com/labstack/echo/v4"

const (
	// DefaultAdminUserName is the default admin user name
	DefaultAdminUserName = "admin"
)

//StratosAuth provides common access to Stratos login/logout functionality
type StratosAuth interface {
	ShowConfig(config *ConsoleConfig)
	Login(c echo.Context) error
	Logout(c echo.Context) error
	GetUsername(userGUID string) (string, error)
	GetUser(userGUID string) (*ConnectedUser, error)
	VerifySession(c echo.Context, sessionUser string, sessionExpireTime int64) error
	BeforeVerifySession(c echo.Context)
}
