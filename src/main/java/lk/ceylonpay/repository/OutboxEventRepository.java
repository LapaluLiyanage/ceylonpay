package lk.ceylonpay.repository;

import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import lk.ceylonpay.entity.OutboxEvent;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface OutboxEventRepository extends JpaRepository<OutboxEvent, String> {

    /**
     * Oldest events that are ready to send, locked so that two app instances never deliver the same
     * event at once. A timeout of -2 is "skip locked": rows another instance holds are passed over.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    @Query("select e from OutboxEvent e where e.published = false and e.dead = false "
            + "and (e.nextAttemptAt is null or e.nextAttemptAt <= :now) order by e.createdAt asc")
    List<OutboxEvent> lockDue(@Param("now") LocalDateTime now, Pageable limit);

    List<OutboxEvent> findByDeadTrueOrderByCreatedAtAsc();

    long countByPublishedFalseAndDeadFalse();

}
