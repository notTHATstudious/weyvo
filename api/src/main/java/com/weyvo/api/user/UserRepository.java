package com.weyvo.api.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, Long> {

    @Query("select u from User u where lower(u.email) = lower(?1)")
    Optional<User> findByEmailIgnoreCase(String email);

    @Query("select count(u) > 0 from User u where lower(u.email) = lower(?1)")
    boolean existsByEmailIgnoreCase(String email);

    @Query("select count(u) > 0 from User u where lower(u.username) = lower(?1)")
    boolean existsByUsernameIgnoreCase(String username);
}
