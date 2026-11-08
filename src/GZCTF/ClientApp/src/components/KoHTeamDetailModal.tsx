import {
  Avatar,
  Badge,
  Center,
  Group,
  Loader,
  Modal,
  ModalProps,
  ScrollArea,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core'
import { mdiAccountGroup, mdiCrown } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { fmtKoHPoints } from '@Components/KoHChallengePanel'
import { ScrollingText } from '@Components/ScrollingText'
import { OnceSWRConfig } from '@Hooks/useConfig'
import api, { KoHTeamScoreRow } from '@Api'
import modalClasses from '@Styles/ScoreboardItemModal.module.css'

interface KoHTeamDetailModalProps extends ModalProps {
  row: KoHTeamScoreRow | null
}

export const KoHTeamDetailModal: FC<KoHTeamDetailModalProps> = ({ row, ...modalProps }) => {
  const { t } = useTranslation()
  const teamId = row?.teamId ?? 0

  const { data: team, error } = api.team.useTeamGetBasicInfo(teamId, OnceSWRConfig, !!modalProps.opened && teamId > 0)

  const members = team?.members ?? []
  const stats = row
    ? [
        { label: t('game.label.score_table.rank_total'), value: row.rank, color: undefined },
        { label: t('game.content.koh.total'), value: fmtKoHPoints(row.total), color: 'violet' },
        {
          label: t('game.content.koh.ticks'),
          value: row.hills.reduce((sum, hill) => sum + hill.ticksHeld, 0),
          color: undefined,
        },
      ]
    : []

  return (
    <Modal
      {...modalProps}
      classNames={{ header: modalClasses.header, title: modalClasses.titleBar }}
      title={
        <Group justify="left" gap="md" wrap="nowrap" className={modalClasses.titleGroup}>
          <Avatar alt="avatar" src={team?.avatar ?? row?.avatar} size={50} radius="md" className={modalClasses.avatar}>
            {(team?.name ?? row?.teamName)?.slice(0, 1) ?? 'T'}
          </Avatar>
          <Stack gap={0} className={modalClasses.infoWrap}>
            <Group gap={4} wrap="nowrap" className={modalClasses.nameRow}>
              <ScrollingText
                text={team?.name ?? row?.teamName ?? ''}
                size="lg"
                fw="bold"
                className={modalClasses.teamName}
                miw="5rem"
              />
              {!!row?.division && (
                <Badge size="sm" variant="outline" className={modalClasses.divisionBadge}>
                  {row.division}
                </Badge>
              )}
            </Group>
            <ScrollingText text={team?.bio || t('team.placeholder.bio')} size="sm" className={modalClasses.bioText} />
          </Stack>
        </Group>
      }
    >
      <Stack align="center" gap="md">
        <Group grow ta="center" w="85%" miw="20rem">
          {stats.map((stat) => (
            <Stack key={stat.label} gap={2}>
              <Text fw="bold" size="sm" ff="monospace" c={stat.color}>
                {stat.value}
              </Text>
              <Text size="xs" fw={500}>
                {stat.label}
              </Text>
            </Stack>
          ))}
        </Group>

        <Stack w="85%" miw="20rem" gap="xs">
          <Group gap={6}>
            <Icon path={mdiAccountGroup} size={0.8} color="var(--mantine-color-dimmed)" />
            <Text size="sm" fw={600} c="dimmed">
              {t('team.label.members')}
              {members.length > 0 ? ` (${members.length})` : ''}
            </Text>
          </Group>

          {!team && !error ? (
            <Center mih="6rem">
              <Loader size="sm" />
            </Center>
          ) : error ? (
            <Center mih="4rem">
              <Text size="sm" c="dimmed">
                {t('game.content.koh.team_detail_error')}
              </Text>
            </Center>
          ) : (
            <ScrollArea scrollbarSize={6} h="14rem" w="100%" scrollbars="y">
              <Stack gap="xs">
                {members.map((member) => (
                  <Group key={member.id ?? member.userName} gap="sm" wrap="nowrap">
                    <Avatar alt="avatar" src={member.avatar} size={34} radius="xl">
                      {member.userName?.slice(0, 1) ?? 'U'}
                    </Avatar>
                    <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm" fw={600} truncate>
                          {member.userName}
                        </Text>
                        {member.captain && (
                          <Tooltip label={t('team.content.role.captain')} withinPortal>
                            <span style={{ display: 'inline-flex' }}>
                              <Icon path={mdiCrown} size={0.6} color="var(--mantine-color-yellow-6)" />
                            </span>
                          </Tooltip>
                        )}
                      </Group>
                      {!!member.bio && (
                        <Text size="xs" c="dimmed" truncate>
                          {member.bio}
                        </Text>
                      )}
                    </Stack>
                  </Group>
                ))}
              </Stack>
            </ScrollArea>
          )}
        </Stack>
      </Stack>
    </Modal>
  )
}
