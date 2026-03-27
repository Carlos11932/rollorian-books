import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { FollowButton } from "./follow-button";

interface ProfileHeaderProps {
  userId: string;
  name: string | null;
  image: string | null;
  bookCount: number;
  followerCount: number;
  followingCount: number;
  /** Whether the currently logged-in viewer follows this user */
  isFollowing: boolean;
  /** Whether this profile belongs to the logged-in user */
  isOwnProfile: boolean;
  /** Whether viewer is authenticated (false = unauthenticated visitor) */
  isAuthenticated: boolean;
}

export async function ProfileHeader({
  userId,
  name,
  image,
  bookCount,
  followerCount,
  followingCount,
  isFollowing,
  isOwnProfile,
  isAuthenticated,
}: ProfileHeaderProps) {
  const t = await getTranslations("profile");
  const displayName = name ?? "Anonymous";

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 rounded-2xl bg-surface-container-low border border-outline-variant/20">
      {/* Avatar */}
      <div className="shrink-0">
        {image ? (
          <Image
            src={image}
            alt={displayName}
            width={80}
            height={80}
            className="rounded-full object-cover w-20 h-20"
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[40px]">
              person
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-on-surface truncate">
          {displayName}
        </h1>

        {/* Stats row */}
        <div className="flex gap-6 mt-2">
          <div className="text-center">
            <p className="text-lg font-bold text-on-surface">{bookCount}</p>
            <p className="text-xs text-tertiary">{t("books")}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-on-surface">{followerCount}</p>
            <p className="text-xs text-tertiary">{t("followers")}</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-on-surface">
              {followingCount}
            </p>
            <p className="text-xs text-tertiary">{t("following")}</p>
          </div>
        </div>
      </div>

      {/* Action button */}
      {isAuthenticated && !isOwnProfile && (
        <FollowButton targetUserId={userId} isFollowing={isFollowing} />
      )}
    </div>
  );
}
