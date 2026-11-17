package fr.adaptatic.foods;

/** Open Food Facts est injoignable ou répond mal. */
public class UpstreamException extends RuntimeException {
    public UpstreamException(String message, Throwable cause) {
        super(message, cause);
    }
}
