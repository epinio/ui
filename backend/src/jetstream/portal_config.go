package main

import (
	"github.com/epinio/ui-backend/src/jetstream/cf-common/env"
	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
)

func (p *portalProxy) GetConfig() *interfaces.PortalConfig {
	return &p.Config
}

func (p *portalProxy) Env() *env.VarSet {
	return p.env
}
