import { Badge, Center, CopyButton, Group, ScrollArea, Stack, Switch, Table, Text, Title, Tooltip } from '@mantine/core'
import { mdiCrown } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { kohStatusColor } from '@Components/KoHChallengePanel'
import { WithGameEditTab } from '@Components/admin/WithGameEditTab'
import { showErrorMsg } from '@Utils/Shared'
import { OnceSWRConfig } from '@Hooks/useConfig'
import api, { KoHAdminHillModel } from '@Api'
import misc from '@Styles/Misc.module.css'

const fmtPoints = (value: number) => (Number.isInteger(value) ? value.toString() : value.toFixed(1))

const HEALTH_STATUSES = ['Ok', 'Mumble', 'Offline', 'InternalError']

const GameKoH: FC = () => {
  const { id } = useParams()
  const numId = parseInt(id ?? '-1')
  const { t } = useTranslation()
  const [busyHill, setBusyHill] = useState<number | null>(null)

  const { data: state, mutate } = api.edit.useEditKoHState(numId, {
    ...OnceSWRConfig,
    refreshInterval: 5 * 1000,
  })

  const toggleHill = async (hill: KoHAdminHillModel) => {
    setBusyHill(hill.challengeId)
    try {
      await api.edit.editUpdateGameChallenge(numId, hill.challengeId, { isEnabled: !hill.isEnabled })
      await mutate()
    } catch (err) {
      showErrorMsg(err, t)
    } finally {
      setBusyHill(null)
    }
  }

  const hills = state?.hills ?? []
  const enabledHills = hills.filter((hill) => hill.isEnabled)

  return (
    <WithGameEditTab
      isLoading={!state}
      head={
        state && (
          <Group gap="xs">
            <Badge variant="light">{t('admin.content.games.koh.round', { round: state.latestRound })}</Badge>
            <Badge variant="light" color="gray" tt="none">
              {t('admin.content.games.koh.summary', {
                seconds: state.tickSeconds,
                ticks: state.refreshTicks,
                points: fmtPoints(state.holdPointsPerTick),
              })}
            </Badge>
            {HEALTH_STATUSES.map((status) => {
              const count = hills.filter((hill) => hill.isEnabled && hill.lastCheckStatus === status).length
              return (
                count > 0 && (
                  <Badge key={status} variant="light" color={kohStatusColor(status)}>
                    {status}: {count}
                  </Badge>
                )
              )
            })}
          </Group>
        )
      }
    >
      {hills.length === 0 ? (
        <Center w="100%" mih="calc(100vh - 180px)">
          <Stack gap={0}>
            <Title order={2}>{t('admin.content.games.koh.empty.title')}</Title>
            <Text>{t('admin.content.games.koh.empty.description')}</Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="lg">
          <ScrollArea type="auto">
            <Table verticalSpacing="xs" highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('admin.content.games.koh.hill')}</Table.Th>
                  <Table.Th>{t('admin.content.games.koh.health')}</Table.Th>
                  <Table.Th>{t('admin.content.games.koh.king')}</Table.Th>
                  <Table.Th>{t('admin.content.games.koh.last_reset')}</Table.Th>
                  <Table.Th>{t('admin.content.games.koh.endpoint')}</Table.Th>
                  <Table.Th w={90}>{t('admin.content.games.koh.enabled')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {hills.map((hill) => {
                  const endpoint = hill.containerIp ? `${hill.containerIp}:${hill.containerPort}` : null
                  return (
                    <Table.Tr key={hill.challengeId} style={{ opacity: hill.isEnabled ? 1 : 0.5 }}>
                      <Table.Td>
                        <Text fw="bold" size="sm">
                          {hill.title}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge
                          size="sm"
                          color={kohStatusColor(hill.lastCheckStatus)}
                          variant={hill.lastCheckStatus ? 'light' : 'outline'}
                        >
                          {hill.lastCheckStatus ?? '-'}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        {hill.currentHolderTeamName ? (
                          <Group gap={4} wrap="nowrap">
                            <Icon path={mdiCrown} size={0.7} color="var(--mantine-color-yellow-6)" />
                            <Text size="sm" truncate maw="12rem">
                              {hill.currentHolderTeamName}
                            </Text>
                          </Group>
                        ) : (
                          <Text size="sm" c="dimmed">
                            {t('admin.content.games.koh.no_king')}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {hill.lastRefreshRound > 0
                            ? t('admin.content.games.koh.round', { round: hill.lastRefreshRound })
                            : '-'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        {endpoint ? (
                          <CopyButton value={endpoint}>
                            {({ copied, copy }) => (
                              <Tooltip
                                label={copied ? t('game.content.koh.copied') : t('game.content.koh.copy_target')}
                              >
                                <Text className={misc.ffmono} size="xs" style={{ cursor: 'pointer' }} onClick={copy}>
                                  {endpoint}
                                </Text>
                              </Tooltip>
                            )}
                          </CopyButton>
                        ) : (
                          <Text size="xs" c="dimmed">
                            {t('admin.content.games.koh.no_container')}
                          </Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={t('admin.content.games.koh.toggle_tip')} multiline maw="20rem">
                          <Switch
                            checked={hill.isEnabled}
                            disabled={busyHill === hill.challengeId}
                            onChange={() => toggleHill(hill)}
                            aria-label={hill.title}
                          />
                        </Tooltip>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          <Stack gap="xs">
            <Title order={5}>{t('admin.content.games.koh.leaderboard')}</Title>
            {state?.teams.length === 0 || enabledHills.length === 0 ? (
              <Text size="sm" c="dimmed">
                {t('admin.content.games.koh.no_scores')}
              </Text>
            ) : (
              <ScrollArea h="40vh" type="auto">
                <Table verticalSpacing="xs" striped highlightOnHover withColumnBorders>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th w={40}>#</Table.Th>
                      <Table.Th>{t('common.label.team')}</Table.Th>
                      <Table.Th w={70}>{t('game.content.koh.total')}</Table.Th>
                      {enabledHills.map((hill) => (
                        <Table.Th key={hill.challengeId}>
                          <Text truncate fw="bold" size="xs" maw="8rem">
                            {hill.title}
                          </Text>
                        </Table.Th>
                      ))}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {state?.teams.map((row) => (
                      <Table.Tr key={row.teamId}>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {row.rank}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text truncate fw="bold" size="sm" maw="12rem">
                            {row.teamName}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Text fw="bold" size="sm">
                            {fmtPoints(row.total)}
                          </Text>
                        </Table.Td>
                        {enabledHills.map((hill) => {
                          const cell = row.hills.find((item) => item.challengeId === hill.challengeId)
                          return (
                            <Table.Td key={hill.challengeId}>
                              <Group gap={4} wrap="nowrap">
                                <Text size="sm">{fmtPoints(cell?.points ?? 0)}</Text>
                                {cell?.isCurrentHolder && (
                                  <Icon path={mdiCrown} size={0.55} color="var(--mantine-color-yellow-6)" />
                                )}
                              </Group>
                            </Table.Td>
                          )
                        })}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Stack>
        </Stack>
      )}
    </WithGameEditTab>
  )
}

export default GameKoH
