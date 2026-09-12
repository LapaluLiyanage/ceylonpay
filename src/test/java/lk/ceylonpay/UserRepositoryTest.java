package lk.ceylonpay;

import lk.ceylonpay.entity.User;
import lk.ceylonpay.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class UserRepositoryTest {

    @Autowired
    private UserRepository userRepository;

    @Test
    void savesAndFindsUserByPhone() {
        User user = new User();
        user.setName("Nimal Perera");
        user.setPhone("0771234567");
        user.setNic("991234567V");
        user.setPassword("placeholder");

        userRepository.save(user);

        Optional<User> found = userRepository.findByPhone("0771234567");

        assertThat(found).isPresent();
        assertThat(found.get().getName()).isEqualTo("Nimal Perera");
    }

}
