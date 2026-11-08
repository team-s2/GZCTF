import {
  Accordion,
  Badge,
  Button,
  Code,
  CopyButton,
  Group,
  List,
  Modal,
  ModalProps,
  Stack,
  Table,
  Text,
} from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { mdiBookOpenVariantOutline, mdiContentCopy, mdiCounter, mdiCrown, mdiRefresh } from '@mdi/js'
import { Icon } from '@mdi/react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Copyable, kohStatusColor } from '@Components/KoHChallengePanel'
import { useGameTeamInfo, useKoHScoreboard } from '@Hooks/useGame'
import api, { ChallengeType } from '@Api'
import misc from '@Styles/Misc.module.css'

const CommandBlock: FC<{ value: string }> = ({ value }) => {
  const { t } = useTranslation()

  return (
    <Stack gap={4}>
      <Code block className={misc.ffmono}>
        {value}
      </Code>
      <Group justify="flex-end">
        <CopyButton value={value}>
          {({ copied, copy }) => (
            <Button
              size="compact-xs"
              variant="subtle"
              leftSection={<Icon path={mdiContentCopy} size={0.7} />}
              onClick={copy}
            >
              {copied ? t('game.content.koh.copied') : t('game.content.koh.guide.copy')}
            </Button>
          )}
        </CopyButton>
      </Group>
    </Stack>
  )
}

interface KoHGuideModalProps extends ModalProps {
  gameId: number
}

export const KoHGuideModal: FC<KoHGuideModalProps> = ({ gameId, ...modalProps }) => {
  const { t } = useTranslation()
  const { opened } = modalProps

  const { data: tokenData } = api.game.useGameKoHToken(gameId, { refreshInterval: 15_000 }, opened)
  const { data: hills } = api.game.useGameKoHHills(gameId, { refreshInterval: 10_000 }, opened)
  const { scoreboard } = useKoHScoreboard(gameId)
  const ticks = scoreboard?.refreshTicks ?? 0

  const apiUrl = `${window.location.origin}/api/game/${gameId}/koh`
  const auth = '-b "GZCTF_Token=$GZCTF_TOKEN"'

  const tokenCommand = `export GZCTF_TOKEN='<cookie value>'\ncurl -sS ${auth} ${apiUrl}/token | jq -r .token`
  const plantCommand = `# depends on the hill's vulnerability, the goal is:\nprintf '%s' "$TOKEN" > /koh/king`
  const hillsCommand = `curl -sS ${auth} ${apiUrl}/hills \\\n  | jq '.[] | {title, entry, holder: .holderTeamName, isYou, status}'`

  return (
    <Modal
      size="48rem"
      centered
      title={
        <Text fw="bold" size="lg">
          {t('game.content.koh.guide.title')}
        </Text>
      }
      {...modalProps}
    >
      <Stack gap="md">
        <Text size="sm">{t('game.content.koh.guide.intro')}</Text>

        <Group gap={6} wrap="nowrap">
          <Text size="sm" fw="bold" style={{ whiteSpace: 'nowrap' }}>
            {t('game.content.koh.your_token')}:
          </Text>
          {tokenData?.token ? (
            <Copyable value={tokenData.token} tooltip={t('game.content.koh.copy_token')} />
          ) : (
            <Text size="xs" c="dimmed" fs="italic">
              {tokenData?.status === 'no-token' ? t('game.content.koh.no_token') : t('game.content.koh.warmup')}
            </Text>
          )}
        </Group>

        {!!hills?.length && (
          <Table.ScrollContainer minWidth="100%">
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>{t('game.content.koh.hill')}</Table.Th>
                  <Table.Th>{t('game.content.koh.target')}</Table.Th>
                  <Table.Th>{t('game.content.koh.guide.holder')}</Table.Th>
                  <Table.Th ta="right">{t('game.content.koh.guide.status')}</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {hills.map((hill) => (
                  <Table.Tr key={hill.challengeId}>
                    <Table.Td>{hill.title}</Table.Td>
                    <Table.Td className={misc.ffmono}>{hill.entry ?? '-'}</Table.Td>
                    <Table.Td>{hill.isYou ? t('game.content.koh.you_hold') : (hill.holderTeamName ?? '-')}</Table.Td>
                    <Table.Td ta="right">
                      <Badge size="sm" variant="light" color={kohStatusColor(hill.status)}>
                        {hill.status ?? t('game.content.koh.no_checks')}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

        <Accordion variant="separated" defaultValue="hill">
          <Accordion.Item value="hill">
            <Accordion.Control icon={<Icon path={mdiCrown} size={1} color="var(--mantine-color-violet-6)" />}>
              <Text fw={600}>{t('game.content.koh.guide.hill.title')}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap="sm">
                <Text size="sm" fw={600}>
                  {t('game.content.koh.guide.hill.step_token')}
                </Text>
                <Text size="sm">{t('game.content.koh.guide.hill.cookie')}</Text>
                <CommandBlock value={tokenCommand} />
                <Text size="sm" fw={600}>
                  {t('game.content.koh.guide.hill.step_plant')}
                </Text>
                <Text size="sm">{t('game.content.koh.guide.hill.plant')}</Text>
                <CommandBlock value={plantCommand} />
                <Text size="sm" fw={600}>
                  {t('game.content.koh.guide.hill.step_check')}
                </Text>
                <Text size="sm">{t('game.content.koh.guide.hill.check')}</Text>
                <CommandBlock value={hillsCommand} />
                <Text size="xs" c="dimmed">
                  {t('game.content.koh.guide.hill.entry')}
                </Text>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="scoring">
            <Accordion.Control icon={<Icon path={mdiCounter} size={1} color="var(--mantine-color-teal-6)" />}>
              <Text fw={600}>{t('game.content.koh.guide.scoring.title')}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>{t('game.content.koh.guide.scoring.check')}</List.Item>
                <List.Item>{t('game.content.koh.guide.scoring.hold')}</List.Item>
                <List.Item>{t('game.content.koh.guide.scoring.penalty')}</List.Item>
                <List.Item>{t('game.content.koh.guide.scoring.grace')}</List.Item>
                <List.Item>{t('game.content.koh.guide.scoring.fault')}</List.Item>
                <List.Item>{t('game.content.koh.guide.scoring.board')}</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="refresh">
            <Accordion.Control icon={<Icon path={mdiRefresh} size={1} color="var(--mantine-color-blue-6)" />}>
              <Text fw={600}>{t('game.content.koh.guide.refresh.title')}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>{t('game.content.koh.guide.refresh.wipe', { ticks })}</List.Item>
                <List.Item>{t('game.content.koh.guide.refresh.token')}</List.Item>
                <List.Item>{t('game.content.koh.guide.refresh.entry')}</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="tips">
            <Accordion.Control
              icon={<Icon path={mdiBookOpenVariantOutline} size={1} color="var(--mantine-color-gray-6)" />}
            >
              <Text fw={600}>{t('game.content.koh.guide.tips.title')}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <List size="sm" spacing="xs">
                <List.Item>{t('game.content.koh.guide.tips.script')}</List.Item>
                <List.Item>{t('game.content.koh.guide.tips.keep')}</List.Item>
                <List.Item>{t('game.content.koh.guide.tips.service')}</List.Item>
                <List.Item>{t('game.content.koh.guide.tips.replay')}</List.Item>
              </List>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Modal>
  )
}

export const KoHGuideButton: FC = () => {
  const { id } = useParams()
  const numId = parseInt(id ?? '-1')
  const { t } = useTranslation()
  const { teamInfo } = useGameTeamInfo(numId)
  const [opened, { open, close }] = useDisclosure(false)

  const hasHills = Object.values(teamInfo?.challenges ?? {})
    .flat()
    .some((challenge) => challenge.type === ChallengeType.KingOfTheHill)

  if (!hasHills) return null

  return (
    <>
      <Button
        fullWidth
        variant="light"
        color="violet"
        leftSection={<Icon path={mdiBookOpenVariantOutline} size={0.8} />}
        onClick={open}
      >
        {t('game.content.koh.guide.open')}
      </Button>
      <KoHGuideModal gameId={numId} opened={opened} onClose={close} />
    </>
  )
}
