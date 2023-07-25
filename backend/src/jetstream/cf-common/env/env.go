package env

import (
	"encoding/hex"
	"fmt"
	"strconv"
)

// Lookup must return the value for the environment variable with the given name
// and whether or not it was found.
type Lookup func(name string) (string, bool)

// NoopLookup always returns false for the environment variable with the
// given name. Useful as a fallback to return for an env lookup that may
// not always be applicable, e.g. if not running in CloudFoundry, a user
// provided service lookup won't be applicable.
func NoopLookup(name string) (string, bool) {
	return "", false
}

// VarSet provides methods to access environment variables from a list of Lookup
// sources.
type VarSet struct {
	// sources are searched sequentially for a given environment variable.
	sources []Lookup
}

// NewVarSet makes a new VarSet from opts.
func NewVarSet(opts ...VarSetOpt) *VarSet {
	v := &VarSet{sources: make([]Lookup, 0)}
	for _, opt := range opts {
		opt(v)
	}
	return v
}

// AppendSource adds s as another lookup source after all existing sources.
func (v *VarSet) AppendSource(s Lookup) *VarSet {
	v.sources = append(v.sources, s)
	return v
}

// String gets the string environment variable with the given name, if set.
// If not found, returns defaultVal.
func (v *VarSet) String(name, defaultVal string) string {
	rv, ok := v.Lookup(name)
	if !ok {
		return defaultVal
	}
	return rv
}

// MustString gets the string environment variable with the given name, if set.
// It will panic with an error if it is not set.
// If desired, callers can use IsVarNotFound when recovering from the panic in
// order to check type of the error.
func (v *VarSet) MustString(name string) string {
	rv, ok := v.Lookup(name)
	if !ok {
		panic(&varNotFoundError{name: name})
	}
	return rv
}

// Bool gets the boolean environment variable with the given name, if set.
// If not found, returns false.
// If found and cannot parse, returns an error.
func (v *VarSet) Bool(name string) (bool, error) {
	val, ok := v.Lookup(name)
	if !ok {
		return false, nil
	}
	rv, err := strconv.ParseBool(val)
	if err != nil {
		return false, &varNotParsableError{name: name}
	}
	return rv, nil
}

// MustBool gets the boolean environment variable with the given name, if set.
// If not set, false is returned. This matches behavior one would often see with
// command line boolean arguments: if you don't set it, it defaults to false.
// It will panic with an error if it is not a valid boolean.
// If desired, callers can use IsVarNotParsable when recovering from the panic
// in order to check type of the error.
func (v *VarSet) MustBool(name string) bool {
	val, ok := v.Lookup(name)
	if !ok {
		return false
	}
	rv, err := strconv.ParseBool(val)
	if err != nil {
		panic(&varNotParsableError{name: name})
	}
	return rv
}

// MustHexEncodedByteArray gets the hex-encoded environment variable with the
// given name, if set.
// It will panic with an error if it is not set if it is not a valid hex-encoded
// string or if its length does not match decodedByteLength.
// If desired, callers can use IsVarNotFound and IsVarNotParsable when
// recovering from the panic in order to check type of the error.
func (v *VarSet) MustHexEncodedByteArray(name string, decodedByteLength int) []byte {
	rv, ok := v.Lookup(name)
	if !ok {
		panic(&varNotFoundError{name: name})
	}
	byteRv, err := hex.DecodeString(rv)
	if err != nil {
		panic(&varNotParsableError{name: name})
	}
	if len(byteRv) != decodedByteLength {
		panic(&varNotParsableError{name: name})
	}
	return byteRv
}

// Lookup looks for a given name within all lookup sources in order.
// If no variable is found, an empty string and false is returned.
func (v *VarSet) Lookup(name string) (string, bool) {
	for _, lookup := range v.sources {
		rv, ok := lookup(name)
		if ok {
			return rv, true
		}
	}
	return "", false
}

// IsSet looks for a given name within all lookup sources in order.
// If found, true is returned, else false.
func (v *VarSet) IsSet(name string) bool {
	_, ok := v.Lookup(name)
	return ok
}

// IsVarNotFound returns a boolean indicating whether the error is known to
// report that an environment variable is not found.
func IsVarNotFound(err error) bool {
	_, ok := err.(*varNotFoundError)
	return ok
}

// NewVarNotFoundErr makes a new error that indicates that an environment
// variable is not found.
func NewVarNotFoundErr(name string) error {
	return &varNotFoundError{name: name}
}

// varNotFoundError is returned when a required environment variable cannot be
// found.
type varNotFoundError struct {
	// name of the environment variable that was not found.
	name string
}

// Error implements error.
func (err *varNotFoundError) Error() string {
	return fmt.Sprintf("environment variable with name %q not found", err.name)
}

// IsVarNotParsable returns a boolean indicating whether the error is known to
// report that an environment variable is not parsable.
func IsVarNotParsable(err error) bool {
	_, ok := err.(*varNotParsableError)
	return ok
}

// NewVarNotParsableErr makes a new error that indicates that an environment
// variable is not parsable.
func NewVarNotParsableErr(name string) error {
	return &varNotParsableError{name: name}
}

// varNotParsableError is returned when a required environment variable cannot
// be parsed.
type varNotParsableError struct {
	// name of the environment variable that was not parsable.
	name string
}

// Error implements error.
func (err *varNotParsableError) Error() string {
	return fmt.Sprintf("environment variable with name %q could not be parsed", err.name)
}
