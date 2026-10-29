-- One row per Razorpay order. Amounts are decided on the server; a paid order grants Premium once.
CREATE TABLE payments (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT       NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    razorpay_order_id   VARCHAR(40)  NOT NULL UNIQUE,
    razorpay_payment_id VARCHAR(40) UNIQUE,
    period              VARCHAR(8)   NOT NULL,
    amount_paise        INTEGER      NOT NULL,
    currency            VARCHAR(3)   NOT NULL DEFAULT 'INR',
    status              VARCHAR(8)   NOT NULL DEFAULT 'CREATED',
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
    paid_at             TIMESTAMPTZ,
    CONSTRAINT payments_period_chk CHECK (period IN ('MONTH', 'YEAR')),
    CONSTRAINT payments_status_chk CHECK (status IN ('CREATED', 'PAID'))
);
CREATE INDEX payments_user_idx ON payments (user_id, created_at DESC);
