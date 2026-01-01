-- Add comprehensive RLS policies for admin backend access
-- Admin backend uses authenticated users with separate admin_sessions protection

-- Profiles: Allow authenticated users to read and update all profiles
CREATE POLICY "Authenticated can update all profiles" 
ON profiles
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- User memberships: Allow authenticated users to read all memberships
CREATE POLICY "Authenticated can view all memberships"
ON user_memberships
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can update memberships"
ON user_memberships
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- User points: Allow authenticated users to read and update all points
CREATE POLICY "Authenticated can view all points"
ON user_points
FOR SELECT
TO authenticated
USING (true);

-- Wallets: Allow authenticated users to read and update all wallets
CREATE POLICY "Authenticated can view all wallets"
ON wallets
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can update all wallets"
ON wallets
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Transactions: Allow authenticated users to read all transactions
CREATE POLICY "Authenticated can view all transactions"
ON transactions
FOR SELECT
TO authenticated
USING (true);

-- Crypto transactions: Allow authenticated users to read and update all crypto transactions
CREATE POLICY "Authenticated can view all crypto transactions"
ON crypto_transactions
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can update all crypto transactions"
ON crypto_transactions
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Conversations: Allow authenticated users to read all conversations
CREATE POLICY "Authenticated can view all conversations"
ON conversations
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete conversations"
ON conversations
FOR DELETE
TO authenticated
USING (true);

-- Messages: Allow authenticated users to read and delete all messages
CREATE POLICY "Authenticated can view all messages"
ON messages
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete messages"
ON messages
FOR DELETE
TO authenticated
USING (true);

-- Conversation participants: Allow authenticated users to read all participants
CREATE POLICY "Authenticated can view all participants"
ON conversation_participants
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete participants"
ON conversation_participants
FOR DELETE
TO authenticated
USING (true);

-- Moments: Allow authenticated users to read and delete all moments
CREATE POLICY "Authenticated can view all moments"
ON moments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can delete moments"
ON moments
FOR DELETE
TO authenticated
USING (true);

-- Sensitive words: Allow authenticated users to manage sensitive words
CREATE POLICY "Authenticated can view sensitive words"
ON sensitive_words
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert sensitive words"
ON sensitive_words
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update sensitive words"
ON sensitive_words
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete sensitive words"
ON sensitive_words
FOR DELETE
TO authenticated
USING (true);

-- Referral rewards: Allow authenticated users to manage referral rewards
CREATE POLICY "Authenticated can view all referral rewards"
ON referral_rewards
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can update referral rewards"
ON referral_rewards
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Referral settings: Allow authenticated users to manage referral settings
CREATE POLICY "Authenticated can view referral settings"
ON referral_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can update referral settings"
ON referral_settings
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Referrals: Allow authenticated users to view all referrals
CREATE POLICY "Authenticated can view all referrals"
ON referrals
FOR SELECT
TO authenticated
USING (true);

-- Lucky draws: Allow authenticated users to view all lucky draws
CREATE POLICY "Authenticated can view all lucky draws"
ON lucky_draws
FOR SELECT
TO authenticated
USING (true);

-- Point products: Allow authenticated users to manage point products
CREATE POLICY "Authenticated can insert point products"
ON point_products
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update point products"
ON point_products
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete point products"
ON point_products
FOR DELETE
TO authenticated
USING (true);

-- Point orders: Allow authenticated users to view and update all point orders
CREATE POLICY "Authenticated can view all point orders"
ON point_orders
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can update point orders"
ON point_orders
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Point transactions: Allow authenticated users to view all point transactions
CREATE POLICY "Authenticated can view all point transactions"
ON point_transactions
FOR SELECT
TO authenticated
USING (true);

-- Daily check-ins: Allow authenticated users to view all check-ins
CREATE POLICY "Authenticated can view all check-ins"
ON daily_check_ins
FOR SELECT
TO authenticated
USING (true);

-- Membership tiers: Allow authenticated users to manage membership tiers
CREATE POLICY "Authenticated can insert membership tiers"
ON membership_tiers
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update membership tiers"
ON membership_tiers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete membership tiers"
ON membership_tiers
FOR DELETE
TO authenticated
USING (true);

-- Avatar frames: Allow authenticated users to manage avatar frames
CREATE POLICY "Authenticated can insert avatar frames"
ON avatar_frames
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Authenticated can update avatar frames"
ON avatar_frames
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Authenticated can delete avatar frames"
ON avatar_frames
FOR DELETE
TO authenticated
USING (true);