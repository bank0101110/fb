-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "config" JSONB NOT NULL,
    "discover" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "games" TEXT[],
    "mode" TEXT NOT NULL DEFAULT 'feed',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wanted" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "game" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keywords" TEXT[],
    "must" TEXT[],
    "nice" TEXT[],
    "exclude" TEXT[],
    "transfer" TEXT[],
    "priceMin" DOUBLE PRECISION,
    "priceMax" DOUBLE PRECISION,
    "priceMarket" DOUBLE PRECISION,
    "maxPostAgeDays" INTEGER,
    "groups" JSONB NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Wanted_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackItem" (
    "key" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[],
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "TrackItem_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "GroupState" (
    "groupId" TEXT NOT NULL,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "postsRead" INTEGER NOT NULL DEFAULT 0,
    "matches" INTEGER NOT NULL DEFAULT 0,
    "recentPostIds" TEXT[],
    "lastReadAt" TIMESTAMP(3),
    "newestPostAt" TIMESTAMP(3),
    "postsPerDay" DOUBLE PRECISION,
    "lastStopReason" TEXT,
    CONSTRAINT "GroupState_pkey" PRIMARY KEY ("groupId")
);

-- CreateTable
CREATE TABLE "Post" (
    "postId" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "url" TEXT,
    "author" TEXT,
    "authorUrl" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedAtRaw" TEXT,
    "kind" TEXT,
    "game" TEXT,
    "items" TEXT[],
    "attrs" TEXT[],
    "price" DOUBLE PRECISION,
    "comments" INTEGER,
    "reactions" INTEGER,
    "text" TEXT,
    "matches" JSONB,
    "runId" TEXT,
    "firstSeen" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soldAt" TIMESTAMP(3),
    "reported" TEXT[],
    CONSTRAINT "Post_pkey" PRIMARY KEY ("postId")
);

-- CreateTable
CREATE TABLE "MatchResult" (
    "id" SERIAL NOT NULL,
    "runId" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "fit" INTEGER NOT NULL,
    "postUrl" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "author" TEXT,
    "authorUrl" TEXT,
    "price" DOUBLE PRECISION,
    "cheaperPct" INTEGER,
    "postedAt" TIMESTAMP(3),
    "has" TEXT[],
    "missing" TEXT[],
    "niceFound" TEXT[],
    "flags" TEXT[],
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Image" (
    "id" SERIAL NOT NULL,
    "productId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Post_game_postedAt_idx" ON "Post"("game", "postedAt");

-- CreateIndex
CREATE INDEX "Post_group_idx" ON "Post"("group");

-- CreateIndex
CREATE INDEX "MatchResult_runId_idx" ON "MatchResult"("runId");

-- CreateIndex
CREATE INDEX "MatchResult_product_idx" ON "MatchResult"("product");

-- CreateIndex
CREATE UNIQUE INDEX "Image_productId_fileName_key" ON "Image"("productId", "fileName");

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Wanted"("id") ON DELETE CASCADE ON UPDATE CASCADE;
