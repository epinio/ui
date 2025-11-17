package api

import (
	"encoding/json"
	"fmt"

	"github.com/labstack/echo/v4"
)

func SendResponse(ec echo.Context, obj interface{}) error {
	jsonString, err := json.Marshal(obj)
	if err != nil {
		return err
	}

	userID := ec.Get("user_id")
	isAuthenticated := userID != nil

	ec.Response().Header().Set("X-Api-Cattle-Auth", fmt.Sprintf("%t", isAuthenticated))
	ec.Response().Header().Set("Content-Type", "application/json")
	ec.Response().Status = 200
	ec.Response().Write([]byte(jsonString))

	return nil
}
