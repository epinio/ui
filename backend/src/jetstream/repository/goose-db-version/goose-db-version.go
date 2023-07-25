package goosedbversion

import (
	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
)

// Repository - the repository required to talk to this table of data
type Repository interface {
	GetCurrentVersion() (interfaces.GooseDBVersionRecord, error)
	List() ([]*interfaces.GooseDBVersionRecord, error)
}
