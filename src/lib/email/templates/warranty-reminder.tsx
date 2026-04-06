import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Section,
} from "@react-email/components";

interface WarrantyReminderEmailProps {
  builderName: string;
  itemTitle: string;
  daysLeft: number;
  homeAddress: string;
  dashboardUrl: string;
  primaryColor: string;
}

export function WarrantyReminderEmail({
  builderName,
  itemTitle,
  daysLeft,
  homeAddress,
  dashboardUrl,
  primaryColor,
}: WarrantyReminderEmailProps) {
  const isOverdue = daysLeft < 0;
  const headingPrefix = isOverdue ? "Overdue: " : "";
  const daysMessage = isOverdue
    ? `This item is ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} overdue.`
    : `You have ${daysLeft} day${daysLeft === 1 ? "" : "s"} left to register.`;

  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
        <Container
          style={{
            maxWidth: "560px",
            margin: "40px auto",
            backgroundColor: "#ffffff",
            borderRadius: "8px",
            padding: "40px",
          }}
        >
          <Section>
            <Heading
              style={{
                color: isOverdue ? "#dc2626" : primaryColor,
                fontSize: "24px",
                fontWeight: "700",
                margin: "0 0 16px",
              }}
            >
              {headingPrefix}Warranty Registration Reminder
            </Heading>
            <Text style={{ color: "#374151", fontSize: "16px", margin: "0 0 12px" }}>
              <strong>{itemTitle}</strong> at {homeAddress} requires warranty registration.
            </Text>
            <Text style={{ color: "#374151", fontSize: "16px", margin: "0 0 24px" }}>
              {daysMessage} Register now to protect your home warranty coverage.
            </Text>
            <Button
              href={dashboardUrl}
              style={{
                backgroundColor: isOverdue ? "#dc2626" : primaryColor,
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                fontSize: "16px",
                fontWeight: "600",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Register Warranty
            </Button>
          </Section>
          <Section style={{ marginTop: "32px" }}>
            <Text
              style={{
                color: "#9ca3af",
                fontSize: "12px",
                margin: "0",
              }}
            >
              Sent on behalf of {builderName}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
