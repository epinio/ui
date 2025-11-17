package env

import "os"

// VarSetOpt is a type which defines VarSet options.
type VarSetOpt func(v *VarSet)

// WithOSLookup configures the VarSet to use the OS env as a lookup source.
func WithOSLookup() VarSetOpt {
	return func(v *VarSet) {
		v.AppendSource(os.LookupEnv)
	}
}

// WithMapLookup configures the VarSet to use the given map as a lookup source.
func WithMapLookup(m map[string]string) VarSetOpt {
	return func(v *VarSet) {
		v.AppendSource(func(k string) (string, bool) {
			v, ok := m[k]
			return v, ok
		})
	}
}
