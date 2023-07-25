package steve

import (
	_ "embed"
	"net/http"

	"github.com/labstack/echo/v4"
)

func GetRancherVersion(c echo.Context) error {
	return c.JSON(http.StatusOK, "")
}
