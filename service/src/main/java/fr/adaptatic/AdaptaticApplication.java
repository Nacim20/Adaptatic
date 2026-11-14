package fr.adaptatic;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class AdaptaticApplication {
    public static void main(String[] args) {
        SpringApplication.run(AdaptaticApplication.class, args);
    }
}
