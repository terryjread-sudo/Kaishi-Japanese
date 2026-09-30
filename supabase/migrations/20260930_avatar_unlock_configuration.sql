-- Add centrally managed avatar thresholds to installations that already published live controls.

update public.kaishi_runtime_configuration
set config = jsonb_set(
  config,
  '{avatarUnlocks}',
  jsonb_build_object(
    'journeyGirlRhythmDays', 5,
    'journeyBoyRhythmDays', 20,
    'journeyFriendRhythmDays', 30,
    'harajukuGirlMasteredWords', 10,
    'harajukuGuyMasteredWords', 25,
    'izakayaCookMasteredWords', 50
  ),
  true
)
where id = 'live' and not (config ? 'avatarUnlocks');
