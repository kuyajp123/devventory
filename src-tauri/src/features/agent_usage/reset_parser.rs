use chrono::{
    DateTime, Datelike, Duration, LocalResult, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc,
    Weekday,
};
use chrono_tz::Tz;
use serde::Serialize;

const MAX_PASTE_LENGTH: usize = 500;
const MAX_RELATIVE_MINUTES: i64 = 10 * 366 * 24 * 60;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum ResetEntryMethod {
    Exact,
    Relative,
    Pasted,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ResetPreview {
    pub(crate) reset_at: DateTime<Utc>,
    pub(crate) timezone: String,
    pub(crate) method: ResetEntryMethod,
    pub(crate) interpretation: String,
    pub(crate) had_explicit_timezone: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ResetParseError {
    Ambiguous,
    Invalid,
    InvalidTimezone,
    OutOfRange,
}

pub(crate) fn validate_timezone(value: &str) -> Result<Tz, ResetParseError> {
    value
        .parse::<Tz>()
        .map_err(|_| ResetParseError::InvalidTimezone)
}

pub(crate) fn preview_exact_reset(
    date: &str,
    time: &str,
    timezone: &str,
) -> Result<ResetPreview, ResetParseError> {
    let timezone_value = validate_timezone(timezone)?;
    let date =
        NaiveDate::parse_from_str(date.trim(), "%Y-%m-%d").map_err(|_| ResetParseError::Invalid)?;
    let time = parse_time(time)?;
    let reset_at = local_to_utc(timezone_value, date.and_time(time))?;
    Ok(preview(
        reset_at,
        timezone_value,
        ResetEntryMethod::Exact,
        false,
    ))
}

pub(crate) fn preview_relative_reset(
    now: DateTime<Utc>,
    days: u32,
    hours: u32,
    minutes: u32,
    timezone: &str,
) -> Result<ResetPreview, ResetParseError> {
    let timezone_value = validate_timezone(timezone)?;
    let total_minutes = i64::from(days)
        .checked_mul(24 * 60)
        .and_then(|value| value.checked_add(i64::from(hours) * 60))
        .and_then(|value| value.checked_add(i64::from(minutes)))
        .ok_or(ResetParseError::OutOfRange)?;
    if total_minutes <= 0 || total_minutes > MAX_RELATIVE_MINUTES {
        return Err(ResetParseError::OutOfRange);
    }
    let reset_at = now
        .checked_add_signed(Duration::minutes(total_minutes))
        .ok_or(ResetParseError::OutOfRange)?;
    Ok(preview(
        reset_at,
        timezone_value,
        ResetEntryMethod::Relative,
        false,
    ))
}

pub(crate) fn parse_pasted_reset(
    input: &str,
    default_timezone: &str,
    now: DateTime<Utc>,
) -> Result<ResetPreview, ResetParseError> {
    let input = input.trim();
    if input.is_empty() || input.chars().count() > MAX_PASTE_LENGTH {
        return Err(ResetParseError::Invalid);
    }

    if let Ok(timestamp) = DateTime::parse_from_rfc3339(input) {
        let timezone = validate_timezone(default_timezone)?;
        return Ok(preview(
            timestamp.with_timezone(&Utc),
            timezone,
            ResetEntryMethod::Pasted,
            true,
        ));
    }

    if let Some((days, hours, minutes)) = parse_relative_duration(input) {
        let mut parsed = preview_relative_reset(now, days, hours, minutes, default_timezone)?;
        parsed.method = ResetEntryMethod::Pasted;
        return Ok(parsed);
    }

    let (text, timezone, had_explicit_timezone) = extract_timezone(input, default_timezone)?;
    if let Some(reset_at) = parse_weekday(&text, timezone, now)? {
        return Ok(preview(
            reset_at,
            timezone,
            ResetEntryMethod::Pasted,
            had_explicit_timezone,
        ));
    }
    if let Some(reset_at) = parse_month_date(&text, timezone, now)? {
        return Ok(preview(
            reset_at,
            timezone,
            ResetEntryMethod::Pasted,
            had_explicit_timezone,
        ));
    }

    Err(ResetParseError::Ambiguous)
}

fn preview(
    reset_at: DateTime<Utc>,
    timezone: Tz,
    method: ResetEntryMethod,
    had_explicit_timezone: bool,
) -> ResetPreview {
    ResetPreview {
        reset_at,
        timezone: timezone.name().to_owned(),
        method,
        interpretation: reset_at
            .with_timezone(&timezone)
            .format("%Y-%m-%d %H:%M %Z")
            .to_string(),
        had_explicit_timezone,
    }
}

fn local_to_utc(timezone: Tz, value: NaiveDateTime) -> Result<DateTime<Utc>, ResetParseError> {
    match timezone.from_local_datetime(&value) {
        LocalResult::Single(value) => Ok(value.with_timezone(&Utc)),
        LocalResult::Ambiguous(_, _) | LocalResult::None => Err(ResetParseError::Ambiguous),
    }
}

fn parse_time(value: &str) -> Result<NaiveTime, ResetParseError> {
    let value = value.trim().to_ascii_uppercase();
    if let Some(time) = ["%H:%M", "%H:%M:%S", "%I:%M %p", "%I %p"]
        .iter()
        .find_map(|format| NaiveTime::parse_from_str(&value, format).ok())
    {
        return Ok(time);
    }

    let tokens = value.split_whitespace().collect::<Vec<_>>();
    if tokens.len() != 2 || !matches!(tokens[1], "AM" | "PM") {
        return Err(ResetParseError::Invalid);
    }
    let clock = tokens[0].split(':').collect::<Vec<_>>();
    if clock.len() > 2 {
        return Err(ResetParseError::Invalid);
    }
    let hour = clock[0]
        .parse::<u32>()
        .map_err(|_| ResetParseError::Invalid)?;
    let minute = clock
        .get(1)
        .map(|value| value.parse::<u32>())
        .transpose()
        .map_err(|_| ResetParseError::Invalid)?
        .unwrap_or(0);
    if !(1..=12).contains(&hour) {
        return Err(ResetParseError::Invalid);
    }
    let hour = hour % 12 + u32::from(tokens[1] == "PM") * 12;
    NaiveTime::from_hms_opt(hour, minute, 0).ok_or(ResetParseError::Invalid)
}

fn parse_relative_duration(input: &str) -> Option<(u32, u32, u32)> {
    let lower = input.to_ascii_lowercase();
    if !lower.contains("reset in") && !lower.contains("resets in") {
        return None;
    }
    let tokens = lower
        .split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|token| !token.is_empty())
        .collect::<Vec<_>>();
    let mut days = 0_u32;
    let mut hours = 0_u32;
    let mut minutes = 0_u32;
    let mut found = false;
    for pair in tokens.windows(2) {
        let Ok(value) = pair[0].parse::<u32>() else {
            continue;
        };
        match pair[1] {
            "day" | "days" => days = days.checked_add(value)?,
            "hour" | "hours" => hours = hours.checked_add(value)?,
            "minute" | "minutes" | "min" | "mins" => minutes = minutes.checked_add(value)?,
            _ => continue,
        }
        found = true;
    }
    found.then_some((days, hours, minutes))
}

fn extract_timezone(
    input: &str,
    default_timezone: &str,
) -> Result<(String, Tz, bool), ResetParseError> {
    let default = validate_timezone(default_timezone)?;
    for token in input.split_whitespace().rev() {
        let candidate = token.trim_matches(|character: char| ",.;()[]".contains(character));
        if !candidate.contains('/') && !candidate.eq_ignore_ascii_case("UTC") {
            continue;
        }
        if let Ok(timezone) = candidate.parse::<Tz>() {
            let text = input.replacen(candidate, "", 1).trim().to_owned();
            return Ok((text, timezone, true));
        }
    }
    Ok((input.to_owned(), default, false))
}

fn parse_weekday(
    input: &str,
    timezone: Tz,
    now: DateTime<Utc>,
) -> Result<Option<DateTime<Utc>>, ResetParseError> {
    let lower = input.to_ascii_lowercase();
    let weekdays = [
        ("monday", Weekday::Mon),
        ("tuesday", Weekday::Tue),
        ("wednesday", Weekday::Wed),
        ("thursday", Weekday::Thu),
        ("friday", Weekday::Fri),
        ("saturday", Weekday::Sat),
        ("sunday", Weekday::Sun),
    ];
    let Some((name, weekday)) = weekdays
        .iter()
        .find(|(name, _)| lower.contains(name))
        .copied()
    else {
        return Ok(None);
    };
    let weekday_start = lower.find(name).ok_or(ResetParseError::Invalid)?;
    let after_weekday = &input[weekday_start + name.len()..];
    let at = after_weekday
        .to_ascii_lowercase()
        .find(" at ")
        .ok_or(ResetParseError::Ambiguous)?;
    let time = parse_time(&after_weekday[at + 4..])?;
    let local_now = now.with_timezone(&timezone);
    let current = i64::from(local_now.weekday().num_days_from_monday());
    let target = i64::from(weekday.num_days_from_monday());
    let mut days_ahead = (target - current).rem_euclid(7);
    let candidate_date = local_now.date_naive() + Duration::days(days_ahead);
    let candidate = local_to_utc(timezone, candidate_date.and_time(time))?;
    if candidate <= now {
        days_ahead += 7;
    }
    local_to_utc(
        timezone,
        (local_now.date_naive() + Duration::days(days_ahead)).and_time(time),
    )
    .map(Some)
}

fn parse_month_date(
    input: &str,
    timezone: Tz,
    now: DateTime<Utc>,
) -> Result<Option<DateTime<Utc>>, ResetParseError> {
    let lower = input.to_ascii_lowercase();
    let months = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    ];
    let Some((month_index, start)) = months
        .iter()
        .enumerate()
        .find_map(|(index, month)| lower.find(month).map(|start| (index, start)))
    else {
        return Ok(None);
    };
    let date_text = input[start..]
        .replace(',', " ")
        .replace(" at ", " ")
        .trim_matches(|character: char| {
            character.is_ascii_punctuation() || character.is_whitespace()
        })
        .to_owned();
    let tokens = date_text.split_whitespace().collect::<Vec<_>>();
    if tokens.len() < 4 {
        return Err(ResetParseError::Ambiguous);
    }
    let local_now = now.with_timezone(&timezone);
    let day = tokens[1]
        .parse::<u32>()
        .map_err(|_| ResetParseError::Ambiguous)?;
    let explicit_year =
        tokens[2].len() == 4 && tokens[2].chars().all(|value| value.is_ascii_digit());
    let (year, time_start) = if explicit_year {
        (
            tokens[2]
                .parse::<i32>()
                .map_err(|_| ResetParseError::Ambiguous)?,
            3,
        )
    } else {
        (local_now.year(), 2)
    };
    let time = parse_time(&tokens[time_start..].join(" "))?;
    let date = NaiveDate::from_ymd_opt(year, month_index as u32 + 1, day)
        .ok_or(ResetParseError::Invalid)?;
    let mut value = date.and_time(time);
    let mut reset_at = local_to_utc(timezone, value)?;
    if !explicit_year && reset_at <= now {
        value = value
            .with_year(local_now.year() + 1)
            .ok_or(ResetParseError::Invalid)?;
        reset_at = local_to_utc(timezone, value)?;
    }
    Ok(Some(reset_at))
}
