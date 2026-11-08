import { Badge, Group, Paper, Select, Stack, Table, Text, Tooltip } from '@mantine/core'
import { mdiCrown } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { kohStatusColor } from '@Components/KoHChallengePanel'
import { useKoHScoreboard } from '@Hooks/useGame'
import misc from '@Styles/Misc.module.css'

const formatPoints = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(2))

interface KoHScoreboardTableProps {
  gameId: number
}

export const KoHScoreboardTable: FC<KoHScoreboardTableProps> = ({ gameId }) => {
  const { t } = useTranslation()
  const { scoreboard } = useKoHScoreboard(gameId)
  const [division, setDivision] = useState<string | null>(null)

  const divisions = useMemo(
    () => [...new Set(scoreboard?.teams.map((team) => team.division).filter((name): name is string => !!name))],
    [scoreboard]
  )

  const teams = scoreboard?.teams.filter((team) => division === null || team.division === division) ?? []

  return (
    <Paper shadow="md" p="md">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="sm" c="dimmed">
            {t('game.content.koh.round', { round: scoreboard?.latestRound ?? 0 })}
            {' · '}
            {t('game.content.koh.refresh_every', { ticks: scoreboard?.refreshTicks ?? 0 })}
          </Text>
          {divisions.length > 0 && (
            <Select
              size="xs"
              clearable
              placeholder={t('game.content.koh.all_divisions')}
              data={divisions}
              value={division}
              onChange={setDivision}
            />
          )}
        </Group>
        <Table.ScrollContainer minWidth="100%">
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('game.content.koh.rank')}</Table.Th>
                <Table.Th>{t('game.content.koh.team')}</Table.Th>
                <Table.Th ta="right">{t('game.content.koh.total')}</Table.Th>
                {scoreboard?.hills.map((hill) => (
                  <Table.Th key={hill.challengeId} ta="right">
                    <Stack gap={2} align="flex-end">
                      <Text size="sm" fw="bold" style={{ whiteSpace: 'nowrap' }}>
                        {hill.title}
                      </Text>
                      <Badge size="xs" color={kohStatusColor(hill.lastCheckStatus)} variant="light">
                        {hill.currentHolderTeamName ?? hill.lastCheckStatus ?? t('game.content.koh.no_checks')}
                      </Badge>
                    </Stack>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {teams.map((team) => (
                <Table.Tr key={team.teamId}>
                  <Table.Td>{team.rank}</Table.Td>
                  <Table.Td style={{ whiteSpace: 'nowrap' }}>{team.teamName}</Table.Td>
                  <Table.Td ta="right" fw="bold" className={misc.ffmono}>
                    {formatPoints(team.total)}
                  </Table.Td>
                  {team.hills.map((cell) => (
                    <Table.Td key={cell.challengeId} ta="right">
                      <Tooltip
                        label={t('game.content.koh.cell_detail', {
                          earned: formatPoints(cell.earned),
                          penalty: formatPoints(cell.penalty),
                          ticks: cell.ticksHeld,
                        })}
                      >
                        <Group gap={4} justify="flex-end" wrap="nowrap">
                          {cell.isCurrentHolder && (
                            <Icon path={mdiCrown} size={0.6} color="var(--mantine-color-violet-6)" />
                          )}
                          <Text size="sm" span className={misc.ffmono}>
                            {formatPoints(cell.points)}
                          </Text>
                        </Group>
                      </Tooltip>
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Stack>
    </Paper>
  )
}
