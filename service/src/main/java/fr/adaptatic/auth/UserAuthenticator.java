package fr.adaptatic.auth;

import java.util.Optional;
import java.util.UUID;

/** Identifie l'utilisateur à partir de l'en-tête Authorization envoyé par l'app. */
public interface UserAuthenticator {
    /** L'identifiant de l'utilisateur, ou vide si le jeton est absent ou invalide. Lève AuthUnavailableException si Supabase ne répond pas. */
    Optional<UUID> authenticate(String authorizationHeader);
}
