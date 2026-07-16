# Trikonekt Workspace Custom Rules

- **Do Not Modify Django Backend**: When working on tasks referencing `tri-consumer` or `tri-business`, do NOT modify, write, delete, or refactor any code inside the Django backend directory (`backend/`). All database table additions, API implementations, and administrative panels must be built strictly inside the Java/Spring Boot backends and React frontends.

- **Java Compilation and Execution**: When compiling or running the Java backends (`tri-consumer` and `tri-business`), always use the repository-specific Java version and Maven tools found in the workspace (specifically, JDK 17 located at `tri-consumer/.jdks/temurin-17` and Maven at `tri-consumer/.maven/apache-maven-3.9.6/bin`). You can invoke the local build/run scripts (`build.ps1`, `run-dev.ps1`) directly, or override the `JAVA_HOME` and `Path` environment variables prior to running `mvn` commands.

