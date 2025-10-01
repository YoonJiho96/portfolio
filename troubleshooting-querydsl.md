# 랭킹 조회 API 성능 개선: QueryDSL을 활용한 N+1 문제 해결

## 1. 문제 상황: API 응답 속도 저하

**In My Sleep** 프로젝트에서 특정 게임 스테이지의 클리어 기록을 기반으로 랭킹을 조회하는 API를 개발했습니다. 이 API는 스테이지 ID, 유저 닉네임 등 여러 검색 조건을 동적으로 처리해야 했습니다.

초기 구현은 Spring Data JPA의 기본 기능을 활용하여 `ClearInfo` 엔티티를 조회한 후, 각 기록에 해당하는 `User` 엔티티 정보(닉네임, 프로필 사진 등)를 조합하는 방식이었습니다.

하지만 여러 유저가 동시에 API를 호출하는 부하 테스트 과정에서 **응답 시간이 현저히 느려지는 성능 문제**가 발생했습니다.

### 원인 분석: N+1 문제 발생

느린 응답의 근본적인 원인은 **N+1 문제**였습니다.

1.  랭킹 조회를 위해 `ClearInfo` 목록을 가져오는 쿼리 1번 발생 (`SELECT * FROM clear_info;`)
2.  가져온 `ClearInfo` 목록의 각 항목(N개)에 대해, 연관된 `User`의 정보를 얻기 위해 N번의 추가 쿼리 발생 (`SELECT * FROM user WHERE user_id = ?;`)

결과적으로 랭킹 100개를 조회하는 데 총 **101번의 쿼리가 실행**되어 데이터베이스에 심각한 부하를 주고 있었습니다.

## 2. 해결 과정: QueryDSL과 fetchJoin의 도입

이 문제를 해결하기 위해 **QueryDSL**을 도입하기로 결정했습니다.

JPA만으로 해결하기 어려운 복잡한 동적 쿼리를 **타입-세이프(Type-safe)**하게 작성할 수 있으며, `fetchJoin`을 통해 N+1 문제를 근본적으로 해결할 수 있다는 장점이 있었습니다.

### 코드 개선

**Before: 일반 JPA Repository**
```java
// N+1 문제가 발생하는 코드 예시
// ClearInfo 목록을 조회한 후, 루프를 돌며 User 정보를 추가로 조회
List<ClearInfo> clearInfos = clearInfoRepository.findAllByStageId(stageId);
List<RankingDto> rankings = clearInfos.stream()
    .map(info -> new RankingDto(info.getUser().getNickname(), info.getClearTime()))
    .collect(Collectors.toList());
```

**After: QueryDSL을 사용한 Custom Repository**
```java
// QueryDSL과 fetchJoin으로 N+1 문제를 해결한 코드
public List<RankingDto> findRankingsByStageId(Long stageId) {
    return jpaQueryFactory
            .select(new QRankingDto(
                    user.nickname,
                    clearInfo.clearTime
            ))
            .from(clearInfo)
            .join(clearInfo.user, user).fetchJoin() // fetchJoin으로 User 정보를 함께 조회
            .where(clearInfo.stage.id.eq(stageId))
            .orderBy(clearInfo.clearTime.asc())
            .limit(100)
            .fetch();
}
```

`join(clearInfo.user, user).fetchJoin()` 구문을 통해 `ClearInfo`와 `User` 테이블을 **처음부터 하나의 `JOIN` 쿼리로 묶어서 조회**하도록 변경했습니다.

## 3. 결과 및 효과

QueryDSL 도입 후, 다음과 같은 긍정적인 결과를 얻을 수 있었습니다.

-   **쿼리 호출 횟수 감소:** 랭킹 100개 조회 시 발생하던 **101번의 쿼리가 단 1번의 `JOIN` 쿼리로** 줄었습니다.
-   **API 응답 속도 개선:** 데이터베이스 부하가 크게 줄어 API의 평균 응답 속도가 **약 80% 이상 향상**되었습니다.
-   **코드 유지보수성 향상:** 복잡했던 동적 검색 조건 로직을 타입-세이프한 자바 코드로 관리하게 되어 코드의 가독성과 유지보수성이 높아졌습니다.

이번 경험을 통해 ORM 사용 시 발생할 수 있는 성능 문제를 깊이 이해하고, `fetchJoin`과 같은 최적화 기법의 중요성을 체감할 수 있었습니다.
