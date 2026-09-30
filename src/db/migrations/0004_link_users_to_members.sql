-- Contas aprovadas passam a fazer parte da Equipe (integrante ligado à conta).
-- Não apaga nada e pode ser executada mais de uma vez: só age em contas aprovadas sem integrante.
DO $$
DECLARE
  u record;
  mid uuid;
BEGIN
  FOR u IN SELECT id, name, email FROM users WHERE status = 'APPROVED' AND member_id IS NULL LOOP
    -- Reaproveita o integrante já cadastrado com o mesmo e-mail (ou o mesmo nome), se nenhuma conta o usa
    SELECT m.id INTO mid FROM members m
      WHERE (lower(m.email) = lower(u.email) OR lower(trim(m.name)) = lower(trim(u.name)))
        AND NOT EXISTS (SELECT 1 FROM users x WHERE x.member_id = m.id)
      ORDER BY lower(m.email) = lower(u.email) DESC
      LIMIT 1;
    IF mid IS NULL THEN
      INSERT INTO members (name, email) VALUES (u.name, u.email) RETURNING id INTO mid;
    END IF;
    UPDATE users SET member_id = mid, updated_at = now() WHERE id = u.id;
  END LOOP;
END $$;
