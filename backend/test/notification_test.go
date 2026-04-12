package unit

import (
	"testing"

	"github.com/asaskevich/govalidator"
	. "github.com/onsi/gomega"

	"github.com/Tawunchai/openvas/entity"
)

func TestValidAppNotificationInput(t *testing.T) {
	g := NewGomegaWithT(t)

	notification := entity.AppNotification{
		Name:            "CPU Alert",
		SendID:          "U123456789",
		Alert:           true,
		IsGroup:         true,
		AppLineMasterID: 1,
	}

	ok, err := govalidator.ValidateStruct(notification)
	g.Expect(ok).To(BeTrue())
	g.Expect(err).To(BeNil())
}

func TestValidAppNotificationFalseBoolInput(t *testing.T) {
	g := NewGomegaWithT(t)

	notification := entity.AppNotification{
		Name:            "CPU Alert",
		SendID:          "U123456789",
		Alert:           false,
		IsGroup:         false,
		AppLineMasterID: 1,
	}

	ok, err := govalidator.ValidateStruct(notification)
	g.Expect(ok).To(BeTrue())
	g.Expect(err).To(BeNil())
}

func TestInvalidAppNotificationNameRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	notification := entity.AppNotification{
		Name:            "",
		SendID:          "U123456789",
		Alert:           true,
		IsGroup:         true,
		AppLineMasterID: 1,
	}

	ok, err := govalidator.ValidateStruct(notification)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Name is required"))
}

func TestInvalidAppNotificationSendIDRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	notification := entity.AppNotification{
		Name:            "CPU Alert",
		SendID:          "",
		Alert:           true,
		IsGroup:         true,
		AppLineMasterID: 1,
	}

	ok, err := govalidator.ValidateStruct(notification)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("SendID is required"))
}

func TestInvalidAppNotificationAppLineMasterIDRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	notification := entity.AppNotification{
		Name:            "CPU Alert",
		SendID:          "U123456789",
		Alert:           true,
		IsGroup:         true,
		AppLineMasterID: 0,
	}

	ok, err := govalidator.ValidateStruct(notification)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("AppLineMasterID is required"))
}

func TestInvalidAppNotificationMultipleFieldsRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	notification := entity.AppNotification{
		Name:            "",
		SendID:          "",
		Alert:           false,
		IsGroup:         false,
		AppLineMasterID: 0,
	}

	ok, err := govalidator.ValidateStruct(notification)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
}