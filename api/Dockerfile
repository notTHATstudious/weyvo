# Weyvo API: built with Maven, run on a slim Java 21 runtime as a non-root user.

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src ./src
RUN mvn -q -B -DskipTests package && cp target/api-*.jar /src/app.jar

FROM eclipse-temurin:21-jre
RUN useradd --system --uid 10001 weyvo
WORKDIR /app
COPY --from=build /src/app.jar app.jar
USER weyvo
# Sized for small hosts (Render free: 512 MB). Headless for image resizing; serial GC uses the least memory.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1 -Djava.awt.headless=true" \
    LOG_FILE=""
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
