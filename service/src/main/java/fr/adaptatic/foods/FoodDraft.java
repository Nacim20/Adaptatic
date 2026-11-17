package fr.adaptatic.foods;

/** Aliment prêt à entrer dans le catalogue partagé. Valeurs pour 100 g, déjà validées. */
public record FoodDraft(String name, String brand, String barcode,
                        double kcal100, double protein100, double carbs100, double fat100,
                        Double servingG, String servingLabel) { }
