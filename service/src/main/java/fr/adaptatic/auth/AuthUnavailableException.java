package fr.adaptatic.auth;

/** Impossible de vérifier le jeton (service mal configuré ou Supabase injoignable). */
public class AuthUnavailableException extends RuntimeException {
    public AuthUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
