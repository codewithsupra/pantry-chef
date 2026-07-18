import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();

function getShelves() {
  return [
    {
      name: "Dairy",
      items: [{ name: "milk" }, { name: "cheese" }, { name: "yogurt" }],
    },
    {
      name: "Fruits",
      items: [{ name: "apple" }, { name: "banana" }, { name: "mango" }],
    },
  ];
}

function getRecipes(userId: string) {
  return [
    {
      name: "Buttermilk Pancakes",
      totalTime: "15 min",
      imgUrl: "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=150&h=150&fit=crop",
      instructions:
        "Whisk together salt, baking powder, baking soda, flour and sugar. In a separate bowl, combine eggs and buttermilk and drizzle in butter. With wooden spoon, combine wet and dry ingredients until just moistened.",
      userId,
      ingredients: {
        create: [
          { amount: "1 tsp", name: "salt" },
          { amount: "2 tsp", name: "baking powder" },
          { amount: "1 tsp", name: "baking soda" },
          { amount: "2 cups", name: "flour" },
          { amount: "2 tbsp", name: "sugar" },
          { amount: "2", name: "eggs" },
          { amount: "2 cups", name: "buttermilk" },
          { amount: "2 tbsp", name: "butter, melted" },
        ],
      },
    },
    {
      name: "French Dip Sandwiches",
      totalTime: "4-10 hrs (crockpot)",
      imgUrl: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=150&h=150&fit=crop",
      instructions:
        "Place roast in slow cooker and sprinkle onion soup mix over the roast. Add water and beef broth. Cook on high for 4-6 hours or low for 8-10. Serve on rolls with swiss cheese.",
      userId,
      ingredients: {
        create: [
          { amount: "", name: "beef roast" },
          { amount: "1 pkg", name: "dry onion soup mix" },
          { amount: "2 cans", name: "beef broth" },
          { amount: "2 cans", name: "water" },
          { amount: "", name: "sliced swiss cheese" },
          { amount: "", name: "hoagie buns" },
        ],
      },
    },
    {
      name: "Shepherds Pie",
      totalTime: "40 min",
      imgUrl: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=150&h=150&fit=crop",
      instructions:
        "Brown ground beef with onion. Add brown sugar, vinegar, tomato soup and mustard. Pour into baking dish and top with mashed potatoes. Sprinkle with grated cheese and bake at 350 for 30 minutes.",
      userId,
      ingredients: {
        create: [
          { amount: "1/4 cup", name: "chopped onion" },
          { amount: "1 lb", name: "ground beef" },
          { amount: "1/3 cup", name: "brown sugar" },
          { amount: "1 tbsp", name: "vinegar" },
          { amount: "1 can", name: "tomato soup" },
          { amount: "1 tsp", name: "mustard" },
          { amount: "", name: "mashed potatoes" },
          { amount: "", name: "grated cheese" },
        ],
      },
    },
    {
      name: "Chicken Alfredo",
      totalTime: "90 min",
      imgUrl: "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?w=150&h=150&fit=crop",
      instructions:
        "Melt butter in large pan. Add garlic and cook for 30 seconds. Whisk in flour and stir for another 30 seconds. Add cream cheese and stir until it starts to melt down. Pour in cream and parmesan and whisk until cream cheese is incorporated. Once the sauce has thickened, season with salt and pepper.\n\nCut chicken into thin pieces. In a shallow dish combine flour, 1 tsp salt and 1 tsp pepper. In another dish beat eggs. In a third dish combine bread crumbs and parmesan. Working with one piece at a time, dredge in flour, then egg, then bread crumb/parmesan mixture. Cover and place in a baking dish and bake at 350 for 50-60 minutes.",
      userId,
      ingredients: {
        create: [
          { amount: "1 stick", name: "butter" },
          { amount: "4", name: "garlic cloves, minced" },
          { amount: "2 tbsp", name: "flour" },
          { amount: "8 oz", name: "cream cheese" },
          { amount: "2 cups", name: "heavy cream" },
          { amount: "1 1/3 cup", name: "grated parmesan cheese" },
          { amount: "", name: "salt and pepper to taste" },
          { amount: "1 pkg", name: "desired pasta" },
          { amount: "2-3", name: "chicken breasts" },
          { amount: "1 cup", name: "flour" },
          { amount: "3", name: "eggs" },
          { amount: "1 1/2 cup", name: "bread crumbs" },
          { amount: "1 1/2 cup", name: "parmesan cheese" },
        ],
      },
    },
  ];
}

async function seed() {
  const email = process.env.SEED_EMAIL || "test@test.com";
  const [first_name, last_name] = process.env.SEED_NAME
    ? process.env.SEED_NAME.split(" ")
    : ["Test", "User"];

  const user = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, first_name, last_name: last_name || "" },
  });

  // Delete existing data for this user to avoid duplicates
  await db.pantryShelf.deleteMany({ where: { userId: user.id } });
  await db.recipe.deleteMany({ where: { userId: user.id } });

  await Promise.all(
    getShelves().map((shelf) =>
      db.pantryShelf.create({
        data: {
          name: shelf.name,
          userId: user.id,
          items: {
            create: shelf.items.map((item) => ({
              name: item.name,
              userId: user.id,
            })),
          },
        },
      })
    )
  );

  await Promise.all(
    getRecipes(user.id).map((recipe) => db.recipe.create({ data: recipe }))
  );
}

seed()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
