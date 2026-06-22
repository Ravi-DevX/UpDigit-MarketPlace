WITH root_categories (id, name, slug, description, sort_order) AS (
    VALUES
        ('00000000-0000-0000-0000-000000000001'::uuid, 'Minecraft', 'minecraft', 'Minecraft assets, setups, plugins, and server resources.', 1),
        ('00000000-0000-0000-0000-000000000002'::uuid, 'Roblox', 'roblox', 'Roblox game assets, scripts, maps, and creative resources.', 2),
        ('00000000-0000-0000-0000-000000000003'::uuid, 'Hytale', 'hytale', 'Hytale plugins, builds, setups, and asset resources.', 3),
        ('00000000-0000-0000-0000-000000000004'::uuid, 'Websites', 'websites', 'Website templates, platform themes, and commerce integrations.', 4),
        ('00000000-0000-0000-0000-000000000005'::uuid, 'Discord', 'discord', 'Discord bots, graphics, and community resources.', 5)
)
INSERT INTO categories (id, parent_id, name, slug, description, sort_order, is_active)
SELECT id, NULL, name, slug, description, sort_order, TRUE
FROM root_categories
ON CONFLICT (slug) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;

WITH child_categories (id, parent_slug, name, slug, description, sort_order) AS (
    VALUES
        ('00000000-0000-0000-0000-000000000101'::uuid, 'minecraft', 'Plugins', 'minecraft-plugins', 'Browse Minecraft plugins. 7K listings.', 1),
        ('00000000-0000-0000-0000-000000000102'::uuid, 'minecraft', 'Server setups', 'minecraft-server-setups', 'Browse Minecraft server setups. 1K listings.', 2),
        ('00000000-0000-0000-0000-000000000103'::uuid, 'minecraft', 'Builds', 'minecraft-builds', 'Browse Minecraft builds. 8K listings.', 3),
        ('00000000-0000-0000-0000-000000000104'::uuid, 'minecraft', 'Configs', 'minecraft-configs', 'Browse Minecraft configs. 3K listings.', 4),
        ('00000000-0000-0000-0000-000000000105'::uuid, 'minecraft', 'Graphics', 'minecraft-graphics', 'Browse Minecraft graphics. 660 listings.', 5),
        ('00000000-0000-0000-0000-000000000106'::uuid, 'minecraft', 'Textures', 'minecraft-textures', 'Browse Minecraft textures. 1K listings.', 6),
        ('00000000-0000-0000-0000-000000000107'::uuid, 'minecraft', 'Models', 'minecraft-models', 'Browse Minecraft models. 3K listings.', 7),
        ('00000000-0000-0000-0000-000000000108'::uuid, 'minecraft', 'Server jars', 'minecraft-server-jars', 'Browse Minecraft server jars. 28 listings.', 8),
        ('00000000-0000-0000-0000-000000000109'::uuid, 'minecraft', 'Skripts', 'minecraft-skripts', 'Browse Minecraft Skripts. 1K listings.', 9),
        ('00000000-0000-0000-0000-000000000110'::uuid, 'minecraft', 'Other', 'minecraft-other', 'Browse other Minecraft resources. 86 listings.', 10),
        ('00000000-0000-0000-0000-000000000201'::uuid, 'roblox', 'Game setups', 'roblox-game-setups', 'Browse Roblox game setups. 1K listings.', 1),
        ('00000000-0000-0000-0000-000000000202'::uuid, 'roblox', 'Maps', 'roblox-maps', 'Browse Roblox maps. 5K listings.', 2),
        ('00000000-0000-0000-0000-000000000203'::uuid, 'roblox', 'Scripts', 'roblox-scripts', 'Browse Roblox scripts. 3K listings.', 3),
        ('00000000-0000-0000-0000-000000000204'::uuid, 'roblox', 'Vehicles', 'roblox-vehicles', 'Browse Roblox vehicles. 228 listings.', 4),
        ('00000000-0000-0000-0000-000000000205'::uuid, 'roblox', 'Weapons', 'roblox-weapons', 'Browse Roblox weapons. 448 listings.', 5),
        ('00000000-0000-0000-0000-000000000206'::uuid, 'roblox', 'Models', 'roblox-models', 'Browse Roblox models. 4K listings.', 6),
        ('00000000-0000-0000-0000-000000000207'::uuid, 'roblox', 'Clothing', 'roblox-clothing', 'Browse Roblox clothing. 997 listings.', 7),
        ('00000000-0000-0000-0000-000000000208'::uuid, 'roblox', 'Graphics & UI', 'roblox-graphics-ui', 'Browse Roblox graphics and UI. 1K listings.', 8),
        ('00000000-0000-0000-0000-000000000209'::uuid, 'roblox', 'Animations & VFX', 'roblox-animations-vfx', 'Browse Roblox animations and VFX. 392 listings.', 9),
        ('00000000-0000-0000-0000-000000000210'::uuid, 'roblox', 'Audio', 'roblox-audio', 'Browse Roblox audio. 31 listings.', 10),
        ('00000000-0000-0000-0000-000000000301'::uuid, 'hytale', 'Plugins', 'hytale-plugins', 'Browse Hytale plugins. 314 listings.', 1),
        ('00000000-0000-0000-0000-000000000302'::uuid, 'hytale', 'Data assets', 'hytale-data-assets', 'Browse Hytale data assets. 28 listings.', 2),
        ('00000000-0000-0000-0000-000000000303'::uuid, 'hytale', 'Server setups', 'hytale-server-setups', 'Browse Hytale server setups. 22 listings.', 3),
        ('00000000-0000-0000-0000-000000000304'::uuid, 'hytale', 'Builds', 'hytale-builds', 'Browse Hytale builds. 260 listings.', 4),
        ('00000000-0000-0000-0000-000000000305'::uuid, 'hytale', 'Graphics', 'hytale-graphics', 'Browse Hytale graphics. 9 listings.', 5),
        ('00000000-0000-0000-0000-000000000306'::uuid, 'hytale', 'Models', 'hytale-models', 'Browse Hytale models. 17 listings.', 6),
        ('00000000-0000-0000-0000-000000000307'::uuid, 'hytale', 'Other', 'hytale-other', 'Browse other Hytale resources. 1 listing.', 7),
        ('00000000-0000-0000-0000-000000000401'::uuid, 'websites', 'Standalone', 'websites-standalone', 'Browse standalone websites. 734 listings.', 1),
        ('00000000-0000-0000-0000-000000000402'::uuid, 'websites', 'Tebex', 'websites-tebex', 'Browse Tebex websites. 140 listings.', 2),
        ('00000000-0000-0000-0000-000000000403'::uuid, 'websites', 'Pterodactyl', 'websites-pterodactyl', 'Browse Pterodactyl websites. 562 listings.', 3),
        ('00000000-0000-0000-0000-000000000404'::uuid, 'websites', 'NamelessMC', 'websites-namelessmc', 'Browse NamelessMC websites. 41 listings.', 4),
        ('00000000-0000-0000-0000-000000000405'::uuid, 'websites', 'XenForo', 'websites-xenforo', 'Browse XenForo websites. 10 listings.', 5),
        ('00000000-0000-0000-0000-000000000406'::uuid, 'websites', 'Invision Community', 'websites-invision-community', 'Browse Invision Community websites. 1 listing.', 6),
        ('00000000-0000-0000-0000-000000000407'::uuid, 'websites', 'WHMCS', 'websites-whmcs', 'Browse WHMCS websites. 31 listings.', 7),
        ('00000000-0000-0000-0000-000000000408'::uuid, 'websites', 'Paymenter', 'websites-paymenter', 'Browse Paymenter websites. 293 listings.', 8),
        ('00000000-0000-0000-0000-000000000409'::uuid, 'websites', 'Calagopus', 'websites-calagopus', 'Browse Calagopus websites.', 9),
        ('00000000-0000-0000-0000-000000000501'::uuid, 'discord', 'Bots', 'discord-bots', 'Browse Discord bots. 640 listings.', 1),
        ('00000000-0000-0000-0000-000000000502'::uuid, 'discord', 'Graphics', 'discord-graphics', 'Browse Discord graphics. 68 listings.', 2),
        ('00000000-0000-0000-0000-000000000503'::uuid, 'discord', 'Other', 'discord-other', 'Browse other Discord resources.', 3)
)
INSERT INTO categories (id, parent_id, name, slug, description, sort_order, is_active)
SELECT child.id, parent.id, child.name, child.slug, child.description, child.sort_order, TRUE
FROM child_categories child
JOIN categories parent ON parent.slug = child.parent_slug
ON CONFLICT (slug) DO UPDATE
SET parent_id = EXCLUDED.parent_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    sort_order = EXCLUDED.sort_order,
    is_active = EXCLUDED.is_active;
