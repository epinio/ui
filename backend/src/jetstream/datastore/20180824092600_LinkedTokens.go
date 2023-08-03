package datastore

import (
	"database/sql"

	"bitbucket.org/liamstask/goose/lib/goose"
)

func init() {
	RegisterMigration(20180824092600, "LinkedTokens", func(txn *sql.Tx, conf *goose.DBConf) error {

		addTokenID := "ALTER TABLE tokens ADD token_guid VARCHAR(36) DEFAULT 'default-token'"
		_, err := txn.Exec(addTokenID)
		if err != nil {
			return err
		}

		addLinkedTokens := "ALTER TABLE tokens ADD linked_token VARCHAR(36)"
		_, err = txn.Exec(addLinkedTokens)
		if err != nil {
			return err
		}

		// Ensure any existing tokens have an ID

		// For UAA tokens, use the user id
		ensureUAATokenID := "UPDATE tokens SET token_guid=user_guid WHERE token_guid='default-token' AND token_type='uaa'"
		_, err = txn.Exec(ensureUAATokenID)
		if err != nil {
			return err
		}

		// For CNSI tokens, use the cnsi guid
		ensureCNSITokenID := "UPDATE tokens SET token_guid=cnsi_guid WHERE token_guid='default-token'"
		_, err = txn.Exec(ensureCNSITokenID)
		if err != nil {
			return err
		}

		return nil
	})
}
