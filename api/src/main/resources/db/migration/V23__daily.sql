-- Daily hooks: one quiz guess and one question answer per person per day, streak bonuses, and an opt-in reminder.
CREATE TABLE daily_guesses (
    user_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day     DATE        NOT NULL,
    answer  VARCHAR(120) NOT NULL,
    correct BOOLEAN     NOT NULL,
    PRIMARY KEY (user_id, day)
);
CREATE INDEX daily_guesses_day_idx ON daily_guesses (day);

CREATE TABLE daily_answers (
    user_id    BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day        DATE         NOT NULL,
    body       VARCHAR(140) NOT NULL,
    place      VARCHAR(120),
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day)
);
CREATE INDEX daily_answers_day_idx ON daily_answers (day);

-- Points for reaching a 7- or 30-day streak, counted in Wey points.
CREATE TABLE daily_bonuses (
    user_id BIGINT      NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    day     DATE        NOT NULL,
    kind    VARCHAR(16) NOT NULL,
    points  INTEGER     NOT NULL,
    PRIMARY KEY (user_id, day, kind)
);

ALTER TABLE users ADD COLUMN daily_reminder BOOLEAN NOT NULL DEFAULT false;
