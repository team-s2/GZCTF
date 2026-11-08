import { Alert, Badge, CopyButton, Group, Loader, Stack, Text, Tooltip } from '@mantine/core'
import { mdiAlertCircleOutline, mdiCrown } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { getProxyUrl } from '@Utils/Shared'
import api from '@Api'
import misc from '@Styles/Misc.module.css'

export const kohStatusColor = (status?: string | null) => {
  switch (status) {
    case 'Ok':
      return 'teal'
    case 'Mumble':
      return 'yellow'
    case 'Offline':
      return 'red'
    default:
      return 'gray'
  }
}

export const fmtKoHPoints = (value: number) =>
  Math.abs(value) >= 100 ? Math.round(value).toString() : value.toFixed(1)

interface CopyableProps {
  value: string
  tooltip: string
}

export const Copyable: FC<CopyableProps> = ({ value, tooltip }) => {
  const { t } = useTranslation()

  return (
    <CopyButton value={value}>
      {({ copied, copy }) => (
        <Tooltip label={copied ? t('game.content.koh.copied') : tooltip}>
          <Text
            className={misc.ffmono}
            size="xs"
            fw="bold"
            truncate
            component="button"
            onClick={copy}
            style={{ cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            {value}
          </Text>
        </Tooltip>
      )}
    </CopyButton>
  )
}

interface KoHChallengePanelProps {
  gameId: number
  challengeId: number
}

export const KoHChallengePanel: FC<KoHChallengePanelProps> = ({ gameId, challengeId }) => {
  const { t } = useTranslation()

  const { data: tokenData } = api.game.useGameKoHToken(gameId, { refreshInterval: 15_000 })
  const { data: hills } = api.game.useGameKoHHills(gameId, { refreshInterval: 10_000 })

  if (!tokenData && !hills) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
      </Group>
    )
  }

  const hill = hills?.find((item) => item.challengeId === challengeId)
  const entry = hill?.entry
  const isProxy = !!entry && entry.length === 36 && !entry.includes(':')

  return (
    <Stack gap={6}>
      <Group justify="space-between" wrap="nowrap">
        <Group gap="xs" wrap="nowrap">
          <Icon path={mdiCrown} size={0.7} color="var(--mantine-color-violet-6)" />
          <Text fw="bold" size="sm">
            {t('game.content.koh.hill')}
          </Text>
          <Badge size="sm" color={kohStatusColor(hill?.status)} variant={hill?.status ? 'filled' : 'light'}>
            {hill?.status ?? t('game.content.koh.no_checks')}
          </Badge>
        </Group>
        {hill?.holderTeamName && (
          <Badge size="sm" color={hill.isYou ? 'violet' : 'gray'} variant={hill.isYou ? 'filled' : 'light'}>
            {hill.isYou ? t('game.content.koh.you_hold') : t('game.content.koh.holder', { team: hill.holderTeamName })}
          </Badge>
        )}
      </Group>

      {entry ? (
        <Group gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed">
            {t('game.content.koh.target')}:
          </Text>
          <Copyable value={isProxy ? getProxyUrl(entry, false) : entry} tooltip={t('game.content.koh.copy_target')} />
          {!!hill?.lastRefreshRound && (
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              · {t('game.content.koh.last_refresh', { round: hill.lastRefreshRound })}
            </Text>
          )}
        </Group>
      ) : (
        hills && (
          <Alert icon={<Icon path={mdiAlertCircleOutline} size={0.9} />} color="orange" variant="light" p="xs">
            <Text size="xs">{t('game.content.koh.no_hill')}</Text>
          </Alert>
        )
      )}

      <Group gap={6} wrap="nowrap">
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {t('game.content.koh.your_token')}:
        </Text>
        {tokenData?.status === 'ready' && tokenData.token ? (
          <Copyable value={tokenData.token} tooltip={t('game.content.koh.copy_token')} />
        ) : (
          <Text size="xs" c="dimmed" fs="italic">
            {tokenData?.status === 'no-token' ? t('game.content.koh.no_token') : t('game.content.koh.warmup')}
          </Text>
        )}
      </Group>

      <Text size="xs" c="dimmed">
        {t('game.content.koh.hint')}
      </Text>
    </Stack>
  )
}
