package factory

import (
	"database/sql"

	"github.com/epinio/ui-backend/src/jetstream/repository/cnsis"
	"github.com/epinio/ui-backend/src/jetstream/repository/interfaces"
	"github.com/epinio/ui-backend/src/jetstream/repository/tokens"
)

// DefaultStoreFactory is default factory for getting store interfaces
type DefaultStoreFactory struct {
	databaseConnectionPool *sql.DB
}

// NewDefaultStoreFactory creates a new default store factory
func NewDefaultStoreFactory(dbPool *sql.DB) interfaces.StoreFactory {
	return &DefaultStoreFactory{
		databaseConnectionPool: dbPool,
	}
}

// EndpointStore gets store for obtaining endpoint information
func (f *DefaultStoreFactory) EndpointStore() (interfaces.EndpointRepository, error) {
	return cnsis.NewPostgresCNSIRepository(f.databaseConnectionPool)
}

// TokenStore gets store for obtaining endpoint information
func (f *DefaultStoreFactory) TokenStore() (interfaces.TokenRepository, error) {
	return tokens.NewPgsqlTokenRepository(f.databaseConnectionPool)
}
