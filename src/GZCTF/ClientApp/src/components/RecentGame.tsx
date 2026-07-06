import { Badge, Box, Card, Center, Group, Image, Stack, Text, Title, useMantineTheme } from '@mantine/core'
import { mdiFlagOutline } from '@mdi/js'
import { Icon } from '@mdi/react'
import dayjs from 'dayjs'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { GAME_POSTER_ASPECT_RATIO, GameColorMap, GameStatus } from '@Components/GameCard'
import { useLanguage } from '@Utils/I18n'
import { useForeground } from '@Hooks/useForeground'
import { getGameStatus } from '@Hooks/useGame'
import { BasicGameInfoModel } from '@Api'
import misc from '@Styles/Misc.module.css'

export interface RecentGameProps {
  game: BasicGameInfoModel
}

export const RecentGame: FC<RecentGameProps> = ({ game, ...others }) => {
  const { t } = useTranslation()
  const { locale } = useLanguage()

  const { title, poster } = game
  const { startTime, endTime, status } = getGameStatus(game)
  const theme = useMantineTheme()

  const color = GameColorMap.get(status)

  const duration = status === GameStatus.OnGoing ? endTime.diff(dayjs(), 'h') : endTime.diff(startTime, 'h')

  const titleColor = useForeground(poster)
  const titleBackground =
    titleColor === 'black'
      ? 'rgba(255, 255, 255, 0.72)'
      : titleColor === 'white'
        ? 'rgba(0, 0, 0, 0.48)'
        : 'light-dark(rgba(255, 255, 255, 0.72), rgba(0, 0, 0, 0.48))'

  return (
    <Card {...others} shadow="sm" component={Link} to={`/games/${game.id}`} classNames={{ root: misc.hoverCard }}>
      <Card.Section>
        <Box pos="relative" style={{ aspectRatio: GAME_POSTER_ASPECT_RATIO }}>
          {poster ? (
            <Image src={poster} w="100%" h="100%" fit="cover" alt="poster" />
          ) : (
            <Center h="100%">
              <Icon path={mdiFlagOutline} size={4} color={theme.colors.gray[5]} />
            </Center>
          )}

          <Group pos="absolute" top={16} right={16} wrap="nowrap" gap="xs" justify="right">
            <Badge size="xs" color={color} variant="filled">
              {status}
            </Badge>
          </Group>

          <Box pos="absolute" left={0} right={0} bottom={0} bg={titleBackground} px={16} py={4}>
            <Title lineClamp={1} order={4} ta="left" c={titleColor}>
              &gt; {title}
            </Title>
          </Box>
        </Box>
      </Card.Section>

      <Stack gap={0} mt={16}>
        <Group wrap="nowrap" gap={0} justify="space-between">
          <Text size="sm" fw="bold">
            {status === GameStatus.Coming ? t('game.content.start_at') : t('game.content.end_at')}
          </Text>
          <Text size="xs" fw="bold">
            {status === GameStatus.Coming
              ? dayjs(startTime).locale(locale).format('L LT')
              : dayjs(endTime).locale(locale).format('L LT')}
          </Text>
        </Group>
        <Group wrap="nowrap" gap={0} justify="space-between">
          <Text size="sm" fw="bold">
            {status === GameStatus.OnGoing ? t('game.content.remaining_time') : t('game.content.total_time')}
          </Text>
          <Text size="xs" fw="bold">
            {t('game.content.duration', { hours: duration })}
          </Text>
        </Group>
      </Stack>
    </Card>
  )
}
