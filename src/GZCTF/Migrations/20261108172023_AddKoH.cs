using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace GZCTF.Migrations
{
    /// <inheritdoc />
    public partial class AddKoH : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "KoHHoldPointsPerTick",
                table: "Games",
                type: "double precision",
                nullable: false,
                defaultValue: 1.0);

            migrationBuilder.AddColumn<int>(
                name: "KoHRefreshTicks",
                table: "Games",
                type: "integer",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<int>(
                name: "KoHTickSeconds",
                table: "Games",
                type: "integer",
                nullable: false,
                defaultValue: 60);

            migrationBuilder.AddColumn<string>(
                name: "KoHCheckerImage",
                table: "GameChallenges",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "KoHRounds",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GameId = table.Column<int>(type: "integer", nullable: false),
                    Number = table.Column<int>(type: "integer", nullable: false),
                    StartedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    EndsAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KoHRounds", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KoHRounds_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KoHTargets",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GameId = table.Column<int>(type: "integer", nullable: false),
                    ChallengeId = table.Column<int>(type: "integer", nullable: false),
                    ContainerId = table.Column<Guid>(type: "uuid", nullable: true),
                    LastRefreshRound = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KoHTargets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KoHTargets_Containers_ContainerId",
                        column: x => x.ContainerId,
                        principalTable: "Containers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_KoHTargets_GameChallenges_ChallengeId",
                        column: x => x.ChallengeId,
                        principalTable: "GameChallenges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KoHTargets_Games_GameId",
                        column: x => x.GameId,
                        principalTable: "Games",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "KoHControlResults",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GameId = table.Column<int>(type: "integer", nullable: false),
                    ChallengeId = table.Column<int>(type: "integer", nullable: false),
                    RoundId = table.Column<int>(type: "integer", nullable: false),
                    ControllingParticipationId = table.Column<int>(type: "integer", nullable: true),
                    Status = table.Column<byte>(type: "smallint", nullable: false),
                    HoldCredit = table.Column<double>(type: "double precision", nullable: false),
                    Penalty = table.Column<double>(type: "double precision", nullable: false),
                    ErrorMessage = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: true),
                    CheckedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KoHControlResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KoHControlResults_GameChallenges_ChallengeId",
                        column: x => x.ChallengeId,
                        principalTable: "GameChallenges",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KoHControlResults_KoHRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "KoHRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KoHControlResults_Participations_ControllingParticipationId",
                        column: x => x.ControllingParticipationId,
                        principalTable: "Participations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "KoHTokens",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    ParticipationId = table.Column<int>(type: "integer", nullable: false),
                    RoundNumber = table.Column<int>(type: "integer", nullable: false),
                    RoundId = table.Column<int>(type: "integer", nullable: false),
                    Token = table.Column<string>(type: "character varying(127)", maxLength: 127, nullable: false),
                    IssuedAt = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KoHTokens", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KoHTokens_KoHRounds_RoundId",
                        column: x => x.RoundId,
                        principalTable: "KoHRounds",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KoHTokens_Participations_ParticipationId",
                        column: x => x.ParticipationId,
                        principalTable: "Participations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_KoHControlResults_ChallengeId_RoundId",
                table: "KoHControlResults",
                columns: new[] { "ChallengeId", "RoundId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KoHControlResults_ControllingParticipationId",
                table: "KoHControlResults",
                column: "ControllingParticipationId");

            migrationBuilder.CreateIndex(
                name: "IX_KoHControlResults_GameId_ChallengeId",
                table: "KoHControlResults",
                columns: new[] { "GameId", "ChallengeId" });

            migrationBuilder.CreateIndex(
                name: "IX_KoHControlResults_RoundId",
                table: "KoHControlResults",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_KoHRounds_GameId_Number",
                table: "KoHRounds",
                columns: new[] { "GameId", "Number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KoHTargets_ChallengeId",
                table: "KoHTargets",
                column: "ChallengeId");

            migrationBuilder.CreateIndex(
                name: "IX_KoHTargets_ContainerId",
                table: "KoHTargets",
                column: "ContainerId");

            migrationBuilder.CreateIndex(
                name: "IX_KoHTargets_GameId_ChallengeId",
                table: "KoHTargets",
                columns: new[] { "GameId", "ChallengeId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KoHTokens_ParticipationId_RoundNumber",
                table: "KoHTokens",
                columns: new[] { "ParticipationId", "RoundNumber" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KoHTokens_RoundId",
                table: "KoHTokens",
                column: "RoundId");

            migrationBuilder.CreateIndex(
                name: "IX_KoHTokens_Token",
                table: "KoHTokens",
                column: "Token",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KoHControlResults");

            migrationBuilder.DropTable(
                name: "KoHTargets");

            migrationBuilder.DropTable(
                name: "KoHTokens");

            migrationBuilder.DropTable(
                name: "KoHRounds");

            migrationBuilder.DropColumn(
                name: "KoHHoldPointsPerTick",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "KoHRefreshTicks",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "KoHTickSeconds",
                table: "Games");

            migrationBuilder.DropColumn(
                name: "KoHCheckerImage",
                table: "GameChallenges");
        }
    }
}
