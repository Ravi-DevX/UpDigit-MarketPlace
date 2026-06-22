package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgconn"
)

type categorySeed struct {
	ID          string
	ParentID    *string
	Name        string
	Slug        string
	Description string
	SortOrder   int
}

func strPtr(value string) *string {
	return &value
}

func (r *Repo) EnsureMarketplaceCategories(ctx context.Context) error {
	roots := []categorySeed{
		{"00000000-0000-0000-0000-000000000001", nil, "Minecraft", "minecraft", "Minecraft assets, setups, plugins, and server resources.", 1},
		{"00000000-0000-0000-0000-000000000002", nil, "Roblox", "roblox", "Roblox game assets, scripts, maps, and creative resources.", 2},
		{"00000000-0000-0000-0000-000000000003", nil, "Hytale", "hytale", "Hytale plugins, builds, setups, and asset resources.", 3},
		{"00000000-0000-0000-0000-000000000004", nil, "Websites", "websites", "Website templates, platform themes, and commerce integrations.", 4},
		{"00000000-0000-0000-0000-000000000005", nil, "Discord", "discord", "Discord bots, graphics, and community resources.", 5},
	}

	children := []categorySeed{
		{"00000000-0000-0000-0000-000000000101", strPtr("00000000-0000-0000-0000-000000000001"), "Plugins", "minecraft-plugins", "Browse Minecraft plugins. 7K listings.", 1},
		{"00000000-0000-0000-0000-000000000102", strPtr("00000000-0000-0000-0000-000000000001"), "Server setups", "minecraft-server-setups", "Browse Minecraft server setups. 1K listings.", 2},
		{"00000000-0000-0000-0000-000000000103", strPtr("00000000-0000-0000-0000-000000000001"), "Builds", "minecraft-builds", "Browse Minecraft builds. 8K listings.", 3},
		{"00000000-0000-0000-0000-000000000104", strPtr("00000000-0000-0000-0000-000000000001"), "Configs", "minecraft-configs", "Browse Minecraft configs. 3K listings.", 4},
		{"00000000-0000-0000-0000-000000000105", strPtr("00000000-0000-0000-0000-000000000001"), "Graphics", "minecraft-graphics", "Browse Minecraft graphics. 660 listings.", 5},
		{"00000000-0000-0000-0000-000000000106", strPtr("00000000-0000-0000-0000-000000000001"), "Textures", "minecraft-textures", "Browse Minecraft textures. 1K listings.", 6},
		{"00000000-0000-0000-0000-000000000107", strPtr("00000000-0000-0000-0000-000000000001"), "Models", "minecraft-models", "Browse Minecraft models. 3K listings.", 7},
		{"00000000-0000-0000-0000-000000000108", strPtr("00000000-0000-0000-0000-000000000001"), "Server jars", "minecraft-server-jars", "Browse Minecraft server jars. 28 listings.", 8},
		{"00000000-0000-0000-0000-000000000109", strPtr("00000000-0000-0000-0000-000000000001"), "Skripts", "minecraft-skripts", "Browse Minecraft Skripts. 1K listings.", 9},
		{"00000000-0000-0000-0000-000000000110", strPtr("00000000-0000-0000-0000-000000000001"), "Other", "minecraft-other", "Browse other Minecraft resources. 86 listings.", 10},
		{"00000000-0000-0000-0000-000000000201", strPtr("00000000-0000-0000-0000-000000000002"), "Game setups", "roblox-game-setups", "Browse Roblox game setups. 1K listings.", 1},
		{"00000000-0000-0000-0000-000000000202", strPtr("00000000-0000-0000-0000-000000000002"), "Maps", "roblox-maps", "Browse Roblox maps. 5K listings.", 2},
		{"00000000-0000-0000-0000-000000000203", strPtr("00000000-0000-0000-0000-000000000002"), "Scripts", "roblox-scripts", "Browse Roblox scripts. 3K listings.", 3},
		{"00000000-0000-0000-0000-000000000204", strPtr("00000000-0000-0000-0000-000000000002"), "Vehicles", "roblox-vehicles", "Browse Roblox vehicles. 228 listings.", 4},
		{"00000000-0000-0000-0000-000000000205", strPtr("00000000-0000-0000-0000-000000000002"), "Weapons", "roblox-weapons", "Browse Roblox weapons. 448 listings.", 5},
		{"00000000-0000-0000-0000-000000000206", strPtr("00000000-0000-0000-0000-000000000002"), "Models", "roblox-models", "Browse Roblox models. 4K listings.", 6},
		{"00000000-0000-0000-0000-000000000207", strPtr("00000000-0000-0000-0000-000000000002"), "Clothing", "roblox-clothing", "Browse Roblox clothing. 997 listings.", 7},
		{"00000000-0000-0000-0000-000000000208", strPtr("00000000-0000-0000-0000-000000000002"), "Graphics & UI", "roblox-graphics-ui", "Browse Roblox graphics and UI. 1K listings.", 8},
		{"00000000-0000-0000-0000-000000000209", strPtr("00000000-0000-0000-0000-000000000002"), "Animations & VFX", "roblox-animations-vfx", "Browse Roblox animations and VFX. 392 listings.", 9},
		{"00000000-0000-0000-0000-000000000210", strPtr("00000000-0000-0000-0000-000000000002"), "Audio", "roblox-audio", "Browse Roblox audio. 31 listings.", 10},
		{"00000000-0000-0000-0000-000000000301", strPtr("00000000-0000-0000-0000-000000000003"), "Plugins", "hytale-plugins", "Browse Hytale plugins. 314 listings.", 1},
		{"00000000-0000-0000-0000-000000000302", strPtr("00000000-0000-0000-0000-000000000003"), "Data assets", "hytale-data-assets", "Browse Hytale data assets. 28 listings.", 2},
		{"00000000-0000-0000-0000-000000000303", strPtr("00000000-0000-0000-0000-000000000003"), "Server setups", "hytale-server-setups", "Browse Hytale server setups. 22 listings.", 3},
		{"00000000-0000-0000-0000-000000000304", strPtr("00000000-0000-0000-0000-000000000003"), "Builds", "hytale-builds", "Browse Hytale builds. 260 listings.", 4},
		{"00000000-0000-0000-0000-000000000305", strPtr("00000000-0000-0000-0000-000000000003"), "Graphics", "hytale-graphics", "Browse Hytale graphics. 9 listings.", 5},
		{"00000000-0000-0000-0000-000000000306", strPtr("00000000-0000-0000-0000-000000000003"), "Models", "hytale-models", "Browse Hytale models. 17 listings.", 6},
		{"00000000-0000-0000-0000-000000000307", strPtr("00000000-0000-0000-0000-000000000003"), "Other", "hytale-other", "Browse other Hytale resources. 1 listing.", 7},
		{"00000000-0000-0000-0000-000000000401", strPtr("00000000-0000-0000-0000-000000000004"), "Standalone", "websites-standalone", "Browse standalone websites. 734 listings.", 1},
		{"00000000-0000-0000-0000-000000000402", strPtr("00000000-0000-0000-0000-000000000004"), "Tebex", "websites-tebex", "Browse Tebex websites. 140 listings.", 2},
		{"00000000-0000-0000-0000-000000000403", strPtr("00000000-0000-0000-0000-000000000004"), "Pterodactyl", "websites-pterodactyl", "Browse Pterodactyl websites. 562 listings.", 3},
		{"00000000-0000-0000-0000-000000000404", strPtr("00000000-0000-0000-0000-000000000004"), "NamelessMC", "websites-namelessmc", "Browse NamelessMC websites. 41 listings.", 4},
		{"00000000-0000-0000-0000-000000000405", strPtr("00000000-0000-0000-0000-000000000004"), "XenForo", "websites-xenforo", "Browse XenForo websites. 10 listings.", 5},
		{"00000000-0000-0000-0000-000000000406", strPtr("00000000-0000-0000-0000-000000000004"), "Invision Community", "websites-invision-community", "Browse Invision Community websites. 1 listing.", 6},
		{"00000000-0000-0000-0000-000000000407", strPtr("00000000-0000-0000-0000-000000000004"), "WHMCS", "websites-whmcs", "Browse WHMCS websites. 31 listings.", 7},
		{"00000000-0000-0000-0000-000000000408", strPtr("00000000-0000-0000-0000-000000000004"), "Paymenter", "websites-paymenter", "Browse Paymenter websites. 293 listings.", 8},
		{"00000000-0000-0000-0000-000000000409", strPtr("00000000-0000-0000-0000-000000000004"), "Calagopus", "websites-calagopus", "Browse Calagopus websites.", 9},
		{"00000000-0000-0000-0000-000000000501", strPtr("00000000-0000-0000-0000-000000000005"), "Bots", "discord-bots", "Browse Discord bots. 640 listings.", 1},
		{"00000000-0000-0000-0000-000000000502", strPtr("00000000-0000-0000-0000-000000000005"), "Graphics", "discord-graphics", "Browse Discord graphics. 68 listings.", 2},
		{"00000000-0000-0000-0000-000000000503", strPtr("00000000-0000-0000-0000-000000000005"), "Other", "discord-other", "Browse other Discord resources.", 3},
	}

	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if err := seedCategories(ctx, tx, roots); err != nil {
		return err
	}
	if err := seedCategories(ctx, tx, children); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type categoryExecer interface {
	Exec(context.Context, string, ...any) (pgconn.CommandTag, error)
}

func seedCategories(ctx context.Context, execer categoryExecer, categories []categorySeed) error {
	const query = `
		INSERT INTO categories (id, parent_id, name, slug, description, sort_order, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, TRUE)
		ON CONFLICT (slug) DO UPDATE
		SET parent_id = EXCLUDED.parent_id,
		    name = EXCLUDED.name,
		    description = EXCLUDED.description,
		    sort_order = EXCLUDED.sort_order,
		    is_active = TRUE
	`
	for _, category := range categories {
		if _, err := execer.Exec(ctx, query, category.ID, category.ParentID, category.Name, category.Slug, category.Description, category.SortOrder); err != nil {
			return err
		}
	}
	return nil
}
