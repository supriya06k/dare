package apperr

import (
	"encoding/json"
	"net/http"
)

type AppError struct {
	Code    int    `json:"-"`
	Message string `json:"error"`
}

func (e *AppError) Error() string { return e.Message }

func New(code int, msg string) *AppError { return &AppError{Code: code, Message: msg} }

var (
	ErrNotFound     = New(http.StatusNotFound, "not found")
	ErrUnauthorized = New(http.StatusUnauthorized, "unauthorized")
	ErrForbidden    = New(http.StatusForbidden, "forbidden")
	ErrBadRequest   = New(http.StatusBadRequest, "bad request")
	ErrConflict     = New(http.StatusConflict, "conflict")
)

func Write(w http.ResponseWriter, err error) {
	ae, ok := err.(*AppError)
	if !ok {
		ae = New(http.StatusInternalServerError, "internal server error")
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(ae.Code)
	json.NewEncoder(w).Encode(ae)
}

func JSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(v)
}
