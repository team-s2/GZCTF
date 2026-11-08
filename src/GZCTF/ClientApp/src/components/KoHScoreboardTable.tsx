import {
  alpha,
  Avatar,
  Badge,
  Box,
  Button,
  Center,
  Grid,
  Group,
  Pagination,
  Paper,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip,
  useMantineColorScheme,
  useMantineTheme,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import {
  mdiAccountGroup,
  mdiClockOutline,
  mdiCrosshairsGps,
  mdiCrown,
  mdiHeartPulse,
  mdiMagnify,
  mdiTimerSandComplete,
} from '@mdi/js'
import { Icon } from '@mdi/react'
import cx from 'clsx'
import { FC, ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtKoHPoints, kohStatusColor } from '@Components/KoHChallengePanel'
import { KoHTeamDetailModal } from '@Components/KoHTeamDetailModal'
import { ScrollingText } from '@Components/ScrollingText'
import { useChallengeCategoryLabelMap } from '@Utils/Shared'
import { getGameStatus, useGame, useKoHScoreboard } from '@Hooks/useGame'
import { ChallengeCategory, KoHScoreboardHill, KoHTeamScoreRow } from '@Api'
import misc from '@Styles/Misc.module.css'
import classes from '@Styles/ScoreboardTable.module.css'

const ITEM_COUNT_PER_PAGE = 30
const HILL_WIDTH = 140
const LEGEND_STATUSES = ['Ok', 'Mumble', 'Offline']

// Pinned columns: overall rank, division rank, team, ticks, total
const Widths = [44, 44, 150, 56, 64]
const Lefts = Widths.reduce(
  (acc, cur) => {
    acc.push(acc[acc.length - 1] + cur)
    return acc
  },
  [0]
)

const totalTicks = (row: KoHTeamScoreRow) => row.hills.reduce((sum, hill) => sum + hill.ticksHeld, 0)

const TickIndicator: FC<{ round: number; endsAt?: string | null; tickSeconds: number; finished: boolean }> = ({
  round,
  endsAt,
  tickSeconds,
  finished,
}) => {
  const { t } = useTranslation()
  const [nowMs, setNowMs] = useState(() => Date.now())
  const live = !finished && !!endsAt

  useEffect(() => {
    if (!live) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [live])

  const remaining = endsAt ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - nowMs) / 1000)) : 0
  const time = `${Math.floor(remaining / 60)}:${(remaining % 60).toString().padStart(2, '0')}`

  return (
    <Stack gap={0} align="flex-end">
      <Text size="xs" fw={600} className={classes.text}>
        {t('game.content.koh.round', { round })}
      </Text>
      {live && (
        <Tooltip withinPortal label={t('game.content.koh.next_tick_tip', { seconds: tickSeconds })}>
          <Group gap={3} wrap="nowrap">
            <Icon path={mdiClockOutline} size={0.55} />
            <Text size="xs" c={remaining <= 5 ? 'orange' : 'dimmed'} className={misc.ffmono}>
              {remaining > 0 ? t('game.content.koh.next_tick', { time }) : t('game.content.koh.next_tick_now')}
            </Text>
          </Group>
        </Tooltip>
      )}
    </Stack>
  )
}

const HiddenCols: FC = () => (
  <>
    {Widths.map((width, idx) => (
      <Table.Th
        key={idx}
        className={classes.left}
        style={{ left: Lefts[idx], width, minWidth: width, maxWidth: width }}
      >
        &nbsp;
      </Table.Th>
    ))}
  </>
)

const LegendItem: FC<{ tip: string; label: string; color: string; icon: ReactNode }> = ({
  tip,
  label,
  color,
  icon,
}) => (
  <Tooltip label={tip} multiline maw="24rem" transitionProps={{ transition: 'pop' }}>
    <Group justify="left" gap={4}>
      {icon}
      <Text size="sm" c={color}>
        {label}
      </Text>
    </Group>
  </Tooltip>
)

const HillCell: FC<{ hill: KoHScoreboardHill; row: KoHTeamScoreRow }> = ({ hill, row }) => {
  const { t } = useTranslation()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const dark = colorScheme === 'dark'

  const cell = row.hills.find((item) => item.challengeId === hill.challengeId)
  const earned = cell?.earned ?? 0
  const penalty = cell?.penalty ?? 0
  const net = cell?.points ?? 0
  const ticks = cell?.ticksHeld ?? 0
  const holding = cell?.isCurrentHolder ?? false

  const background = holding
    ? alpha(theme.colors.violet[dark ? 7 : 4], 0.18)
    : alpha(theme.colors[kohStatusColor(hill.lastCheckStatus)][dark ? 6 : 5], dark ? 0.22 : 0.16)

  const detail =
    penalty > 0
      ? t('game.content.koh.cell.with_penalty', {
          ticks,
          earned: earned.toFixed(1),
          broken: cell?.brokenTicks ?? 0,
          penalty: penalty.toFixed(1),
          net: net.toFixed(1),
        })
      : t('game.content.koh.cell.no_penalty', { ticks, earned: earned.toFixed(1) })

  return (
    <Table.Td className={cx(classes.mono, classes.groupStart)} style={{ background }}>
      <Tooltip label={detail} withinPortal disabled={ticks === 0}>
        <Stack gap={0} align="center">
          <Group gap={4} wrap="nowrap" justify="center">
            <Text size="xs" c="teal" className={misc.ffmono} fw={700}>
              {earned > 0 ? `+${fmtKoHPoints(earned)}` : '0'}
            </Text>
            <Text size="xs" c={penalty > 0 ? 'red' : 'dimmed'} className={misc.ffmono} fw={700}>
              {penalty > 0 ? `-${fmtKoHPoints(penalty)}` : '-0'}
            </Text>
          </Group>
          {ticks > 0 && (
            <Group gap={2} wrap="nowrap" justify="center">
              {holding && <Icon path={mdiCrown} size={0.4} color={theme.colors.violet[dark ? 4 : 7]} />}
              <Text
                c={holding ? 'violet' : 'dimmed'}
                className={misc.ffmono}
                fw={holding ? 800 : 600}
                style={{ fontSize: 9, lineHeight: 1 }}
              >
                = {fmtKoHPoints(net)}
              </Text>
            </Group>
          )}
        </Stack>
      </Tooltip>
    </Table.Td>
  )
}

interface KoHScoreboardTableProps {
  gameId: number
}

export const KoHScoreboardTable: FC<KoHScoreboardTableProps> = ({ gameId }) => {
  const { t } = useTranslation()
  const theme = useMantineTheme()
  const { colorScheme } = useMantineColorScheme()
  const dark = colorScheme === 'dark'
  const categoryLabelMap = useChallengeCategoryLabelMap()

  const { scoreboard, error } = useKoHScoreboard(gameId)
  const { game } = useGame(gameId)
  const { finished } = getGameStatus(game)
  const myTeamName = game?.teamName ?? null

  const [activePage, setPage] = useState(1)
  const [division, setDivision] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword] = useDebouncedValue(keyword, 400)
  const [highlightedTeam, setHighlightedTeam] = useState<string | null>(null)
  const [detailRow, setDetailRow] = useState<KoHTeamScoreRow | null>(null)
  const [detailOpened, setDetailOpened] = useState(false)

  const hillGroups = useMemo(() => {
    const groups: { category: ChallengeCategory; hills: KoHScoreboardHill[] }[] = []
    for (const hill of scoreboard?.hills ?? []) {
      const last = groups[groups.length - 1]
      if (last?.category === hill.category) last.hills.push(hill)
      else groups.push({ category: hill.category, hills: [hill] })
    }
    return groups
  }, [scoreboard?.hills])

  const divisionOptions = useMemo(
    () =>
      [...new Set(scoreboard?.teams.map((team) => team.division).filter((name): name is string => !!name))].map(
        (name) => ({ value: name, label: name })
      ),
    [scoreboard?.teams]
  )

  const search = debouncedKeyword.trim().toLowerCase()
  const allRank = division === null || search.length > 0

  const filteredList = useMemo(() => {
    const teams = scoreboard?.teams ?? []
    if (search.length > 0) return teams.filter((team) => team.teamName.toLowerCase().includes(search))
    if (division !== null) return teams.filter((team) => team.division === division)
    return teams
  }, [scoreboard?.teams, search, division])

  const base = (activePage - 1) * ITEM_COUNT_PER_PAGE
  const currentItems = filteredList.slice(base, base + ITEM_COUNT_PER_PAGE)

  const findMyTeam = () => {
    if (!myTeamName) return
    const idx = filteredList.findIndex((team) => team.teamName === myTeamName)
    if (idx < 0) return
    setPage(Math.floor(idx / ITEM_COUNT_PER_PAGE) + 1)
    setHighlightedTeam(myTeamName)
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-team-name="${CSS.escape(myTeamName)}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    setTimeout(() => setHighlightedTeam(null), 2500)
  }

  if (!scoreboard || scoreboard.hills.length === 0) {
    return (
      <Paper shadow="md" p="xl">
        <Stack align="center" gap="xs">
          <Icon path={mdiCrown} size={2.5} color="var(--mantine-color-dimmed)" />
          <Text fw="bold" c="dimmed">
            {scoreboard
              ? t('game.content.koh.empty')
              : error
                ? t('game.content.koh.load_error')
                : t('game.content.koh.loading')}
          </Text>
        </Stack>
      </Paper>
    )
  }

  const pinnedHeaders = [
    t('game.label.score_table.rank_total'),
    t('game.label.score_table.rank_division'),
    t('common.label.team'),
    t('game.content.koh.ticks'),
    t('game.content.koh.total'),
  ]

  return (
    <Paper shadow="md" p="md">
      <Stack gap="xs">
        <Grid>
          <Grid.Col span={3}>
            <Select
              data={[{ value: 'all', label: t('game.label.score_table.all_teams') }, ...divisionOptions]}
              value={division ?? 'all'}
              readOnly={divisionOptions.length === 0}
              onChange={(value) => {
                setDivision(!value || value === 'all' ? null : value)
                setPage(1)
              }}
              leftSection={<Icon path={mdiAccountGroup} size={1} />}
            />
          </Grid.Col>
          <Grid.Col span={4}>
            {myTeamName && (
              <Button variant="light" leftSection={<Icon path={mdiCrosshairsGps} size={0.9} />} onClick={findMyTeam}>
                {t('game.content.koh.find_my_team')}
              </Button>
            )}
          </Grid.Col>
          <Grid.Col span={2}>
            <Group justify="flex-end" gap="xs" h="100%">
              <TickIndicator
                round={scoreboard.latestRound}
                endsAt={scoreboard.currentRoundEndsAt}
                tickSeconds={scoreboard.tickSeconds}
                finished={finished}
              />
            </Group>
          </Grid.Col>
          <Grid.Col span={3}>
            <TextInput
              placeholder={t('game.placeholder.search_team')}
              value={keyword}
              onChange={(e) => {
                setKeyword(e.currentTarget.value)
                setPage(1)
              }}
              leftSection={<Icon path={mdiMagnify} size={1} />}
            />
          </Grid.Col>
        </Grid>

        <Box pos="relative" mih="calc(100vh - 14rem)">
          <Table.ScrollContainer minWidth="100%" classNames={{ scrollContainer: misc.noScrollBars }}>
            <Table className={classes.table}>
              <Table.Thead className={classes.thead}>
                <Table.Tr className={misc.noBorder}>
                  <HiddenCols />
                  {hillGroups.map((group) => {
                    const cate = categoryLabelMap.get(group.category)
                    return (
                      <Table.Th
                        key={group.category}
                        colSpan={group.hills.length}
                        className={classes.groupStart}
                        h="2.4rem"
                        style={{
                          backgroundColor: cate && alpha(theme.colors[cate.color][dark ? 8 : 6], dark ? 0.15 : 0.2),
                        }}
                      >
                        <Group gap={4} wrap="nowrap" justify="center" w="100%">
                          {cate && <Icon path={cate.icon} size={0.8} color={theme.colors[cate.color][dark ? 8 : 6]} />}
                          <Text c={cate?.color} className={classes.text} ff="text" fz="xs">
                            {group.category}
                          </Text>
                        </Group>
                      </Table.Th>
                    )
                  })}
                  <Table.Th rowSpan={3} aria-hidden />
                </Table.Tr>
                <Table.Tr className={misc.noBorder}>
                  <HiddenCols />
                  {scoreboard.hills.map((hill) => (
                    <Table.Th
                      key={hill.challengeId}
                      className={classes.groupStart}
                      h="2.4rem"
                      style={{ backgroundColor: alpha(theme.colors.violet[dark ? 8 : 6], dark ? 0.12 : 0.14) }}
                    >
                      <Group gap={4} wrap="nowrap" justify="center" w="100%">
                        <Icon path={mdiCrown} size={0.7} color={theme.colors.violet[dark ? 4 : 7]} />
                        <Tooltip label={hill.title} withinPortal>
                          <Text
                            c="violet"
                            className={classes.text}
                            ff="text"
                            fz="xs"
                            fw={700}
                            truncate
                            maw={HILL_WIDTH - 24}
                          >
                            {hill.title}
                          </Text>
                        </Tooltip>
                      </Group>
                    </Table.Th>
                  ))}
                </Table.Tr>
                <Table.Tr>
                  {pinnedHeaders.map((header, idx) => (
                    <Table.Th key={idx} className={cx(classes.left, classes.header)} style={{ left: Lefts[idx] }}>
                      {header}
                    </Table.Th>
                  ))}
                  {scoreboard.hills.map((hill) => (
                    <Table.Th
                      key={hill.challengeId}
                      className={cx(classes.mono, classes.groupStart)}
                      style={{ width: HILL_WIDTH, minWidth: HILL_WIDTH }}
                    >
                      <Tooltip
                        withinPortal
                        label={
                          hill.currentHolderTeamName
                            ? t('game.content.koh.holder', { team: hill.currentHolderTeamName })
                            : t('game.content.koh.legend.status')
                        }
                      >
                        <Center>
                          {hill.currentHolderTeamName ? (
                            <Badge
                              size="xs"
                              variant="filled"
                              color="violet"
                              leftSection={<Icon path={mdiCrown} size={0.4} />}
                              styles={{ root: { textTransform: 'none' } }}
                            >
                              <Text size="xs" truncate maw={HILL_WIDTH - 30} style={{ fontSize: 9 }}>
                                {hill.currentHolderTeamName}
                              </Text>
                            </Badge>
                          ) : (
                            <Icon path={mdiCrown} size={0.55} color={theme.colors.violet[6]} />
                          )}
                        </Center>
                      </Tooltip>
                    </Table.Th>
                  ))}
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {currentItems.map((row, idx) => {
                  const openDetail = () => {
                    setDetailRow(row)
                    setDetailOpened(true)
                  }
                  return (
                    <Table.Tr
                      key={row.teamId}
                      data-team-name={row.teamName}
                      style={
                        highlightedTeam === row.teamName
                          ? {
                              outline: `2px solid ${theme.colors[theme.primaryColor][4]}`,
                              outlineOffset: -2,
                              background: alpha(theme.colors[theme.primaryColor][4], 0.12),
                            }
                          : undefined
                      }
                    >
                      <Table.Td className={cx(classes.mono, classes.left)} style={{ left: Lefts[0] }}>
                        {row.rank}
                      </Table.Td>
                      <Table.Td className={cx(classes.mono, classes.left)} style={{ left: Lefts[1] }}>
                        {allRank ? row.rank : base + idx + 1}
                      </Table.Td>
                      <Table.Td className={classes.left} style={{ left: Lefts[2] }}>
                        <Group
                          justify="left"
                          gap={5}
                          wrap="nowrap"
                          maw={Widths[2] - 10}
                          className={classes.pointer}
                          onClick={openDetail}
                        >
                          <Avatar alt="avatar" src={row.avatar} radius="xl" size={30} color={theme.primaryColor}>
                            {row.teamName.slice(0, 1)}
                          </Avatar>
                          <Stack gap={0} h="2.5rem" justify="center" w={Widths[2] - 45}>
                            <ScrollingText size="sm" text={row.teamName} />
                            {!!row.division && (
                              <Text size="xs" c="dimmed" ta="start" truncate className={classes.text}>
                                {row.division}
                              </Text>
                            )}
                          </Stack>
                        </Group>
                      </Table.Td>
                      <Table.Td className={cx(classes.mono, classes.left)} style={{ left: Lefts[3] }}>
                        {totalTicks(row)}
                      </Table.Td>
                      <Table.Td className={cx(classes.mono, classes.left)} style={{ left: Lefts[4] }}>
                        {row.total.toFixed(1)}
                      </Table.Td>
                      {scoreboard.hills.map((hill) => (
                        <HillCell key={hill.challengeId} hill={hill} row={row} />
                      ))}
                      <Table.Td aria-hidden />
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>

          <Box className={classes.legend}>
            <Group gap="sm" wrap="nowrap">
              <Text size="xs" fw={600} c="dimmed">
                {t('game.content.koh.guide.status')}
              </Text>
              {LEGEND_STATUSES.map((status) => (
                <Group key={status} gap={4} wrap="nowrap">
                  <Box w={9} h={9} bg={`${kohStatusColor(status)}.6`} style={{ borderRadius: 2 }} />
                  <Text size="xs" c="dimmed">
                    {status}
                  </Text>
                </Group>
              ))}
            </Group>
          </Box>

          {filteredList.length === 0 && (
            <Center mih="6rem">
              <Text size="sm" c="dimmed">
                {t('game.content.koh.no_teams')}
              </Text>
            </Center>
          )}
        </Box>

        <Group justify="space-between" align="flex-start" wrap="wrap" gap="md">
          <Stack gap={4}>
            <Tooltip.Group>
              <Group gap="lg">
                <LegendItem
                  tip={t('game.content.koh.legend.earned_tip')}
                  label={t('game.content.koh.legend.earned')}
                  color="teal"
                  icon={
                    <Text size="sm" c="teal" fw={700} ff="monospace">
                      +
                    </Text>
                  }
                />
                <LegendItem
                  tip={t('game.content.koh.legend.penalty_tip')}
                  label={t('game.content.koh.legend.penalty')}
                  color="red"
                  icon={
                    <Text size="sm" c="red" fw={700} ff="monospace">
                      -
                    </Text>
                  }
                />
                <LegendItem
                  tip={t('game.content.koh.legend.holder_tip')}
                  label={t('game.content.koh.legend.holder')}
                  color="violet"
                  icon={<Icon path={mdiCrown} size={0.8} color={theme.colors.violet[6]} />}
                />
                <LegendItem
                  tip={t('game.content.koh.legend.status_tip')}
                  label={t('game.content.koh.legend.status')}
                  color="dimmed"
                  icon={<Icon path={mdiHeartPulse} size={0.8} color="var(--mantine-color-dimmed)" />}
                />
                <LegendItem
                  tip={t('game.content.koh.legend.refresh_tip')}
                  label={t('game.content.koh.legend.refresh', { ticks: scoreboard.refreshTicks })}
                  color="blue"
                  icon={<Icon path={mdiTimerSandComplete} size={0.8} color={theme.colors.blue[6]} />}
                />
              </Group>
            </Tooltip.Group>
            <Text size="xs" c="dimmed">
              {t('game.content.koh.tip')}
            </Text>
          </Stack>
          <Pagination
            value={activePage}
            onChange={setPage}
            total={Math.max(1, Math.ceil(filteredList.length / ITEM_COUNT_PER_PAGE))}
            boundaries={2}
          />
        </Group>
      </Stack>

      <KoHTeamDetailModal
        opened={detailOpened}
        onClose={() => setDetailOpened(false)}
        withCloseButton={false}
        size="34rem"
        row={detailRow}
      />
    </Paper>
  )
}
