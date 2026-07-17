import { Form, NavLink, Outlet, redirect, useLoaderData, useLocation, useNavigation } from "react-router";
import { userContext } from "~/middleware/auth.middleware";
import type { Route } from "./+types/recipes";
import { db } from "~/lib/db.server";
import { RecipeCard, RecipeDetailWrapper, RecipeListWrapper, RecipePageWrapper } from "~/components/recipes.component";
import { SearchBar } from "~/components/search-bar.component";
import { PrimaryButton } from "~/components/button.component";
import { PlusIcon } from "~/components/icons";

export async function loader({ context ,request}: Route.LoaderArgs) {
  const user = context.get(userContext);
  const url = new URL(request.url);
  const query=url.searchParams.get("q");

  const recipes = await db.recipe.findMany({
    where: { userId: user.id ,
        name:{
            contains:query??"",
            mode:"insensitive"
        }
    },
    select:
     { id: true, name: true, totalTime: true, imgUrl: true },
     orderBy:{
        createdAt:"desc"
     }
  });
  return {recipes};
}

export async function action({ context ,request}: Route.ActionArgs) {
  const user = context.get(userContext);
  const recipe = await db.recipe.create({
    data: {
      userId: user.id,
      name: "New Recipe",
      instructions: "",
      totalTime: "30 mins",
      imgUrl: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400",
      metadata: {
        servings: 2,
        difficulty: "easy",
        tags: [],
      },
    },
  });
  const url= new URL(request.url);
  url.pathname=`/app/recipes/${recipe.id}`; // the search params remain embedded
  return redirect(url.toString());
}

export default function Recipes() {
  const {recipes} = useLoaderData<typeof loader>();
  const location=useLocation();
  const navigation=useNavigation();
  console.log("location and navigation",{location,navigation});

  return (
    <RecipePageWrapper>
      <RecipeListWrapper>
        <SearchBar />
        <Form method="post" className="mt-4">
            <PrimaryButton className="w-full" >
                <div className="flex w-full justify-center">
                    <PlusIcon />
                    <span>Create a new recipe!!</span>
                </div>
            </PrimaryButton>

        </Form>
        <ul>
          {recipes.map((recipe) => {
            const isLoading = navigation.location?.pathname === `/app/recipes/${recipe.id}`;

            return(
            <li key={recipe.id} className="my-4">
              <NavLink to={
                {pathname:recipe.id,
                search:location.search
                }
                } prefetch="intent">
                {({ isActive }) => (
                  <RecipeCard
                    name={recipe.name}
                    totalTime={recipe.totalTime}
                    imageUrl={recipe.imgUrl}
                    isActive={isActive}
                    isLoading={isLoading}
                  />
                )}
              </NavLink>
            </li>
          )})}
        </ul>
        
      </RecipeListWrapper>
      <RecipeDetailWrapper>
        <Outlet />
      </RecipeDetailWrapper>
    </RecipePageWrapper>
  );
}
