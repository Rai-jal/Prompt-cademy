/*
  # Notifications System
  
  1. New Tables
    - `notifications` - User notifications
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `type` (text) - Type of notification
      - `title` (text) - Notification title
      - `message` (text) - Notification message
      - `link` (text, nullable) - Optional link to navigate to
      - `read` (boolean) - Whether notification has been read
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on notifications table
    - Users can only read their own notifications
    - Users can update read status on their own notifications
    
  3. Functions
    - Create notification helper function
    - Mark all as read function
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create notification helper function
CREATE OR REPLACE FUNCTION create_notification(
  target_user_id uuid,
  notification_type text,
  notification_title text,
  notification_message text,
  notification_link text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
  new_notification_id uuid;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (target_user_id, notification_type, notification_title, notification_message, notification_link)
  RETURNING id INTO new_notification_id;
  
  RETURN new_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read
CREATE OR REPLACE FUNCTION mark_all_notifications_read(target_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE notifications
  SET read = true
  WHERE user_id = target_user_id AND read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create notifications for achievements
CREATE OR REPLACE FUNCTION notify_badge_earned()
RETURNS TRIGGER AS $$
DECLARE
  badge_info RECORD;
BEGIN
  SELECT name, description INTO badge_info
  FROM badges
  WHERE id = NEW.badge_id;
  
  PERFORM create_notification(
    NEW.user_id,
    'badge_earned',
    'New Badge Earned!',
    'You earned the "' || badge_info.name || '" badge: ' || badge_info.description,
    '/profile'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notify_on_badge_award
  AFTER INSERT ON user_badges
  FOR EACH ROW
  EXECUTE FUNCTION notify_badge_earned();

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
