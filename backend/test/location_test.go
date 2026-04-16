package unit

import (
	"testing"

	"github.com/asaskevich/govalidator"
	. "github.com/onsi/gomega"

	"github.com/Tawunchai/openvas/entity"
)

func TestValidAppLocationInput(t *testing.T) {
	g := NewGomegaWithT(t)

	location := entity.AppLocation{
		Location:   "Laboratory A",
		Building:   "Engineering Building",
		Floor:      3,
		Latitude:   14.882500,
		Longtitude: 102.028000,
		TaskID:     "task-001",
	}

	ok, err := govalidator.ValidateStruct(location)
	g.Expect(ok).To(BeTrue())
	g.Expect(err).To(BeNil())
}

func TestInvalidAppLocationLocationRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	location := entity.AppLocation{
		Location:   "",
		Building:   "Engineering Building",
		Floor:      3,
		Latitude:   14.882500,
		Longtitude: 102.028000,
		TaskID:     "task-001",
	}

	ok, err := govalidator.ValidateStruct(location)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Location is required"))
}

func TestInvalidAppLocationBuildingRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	location := entity.AppLocation{
		Location:   "Laboratory A",
		Building:   "",
		Floor:      3,
		Latitude:   14.882500,
		Longtitude: 102.028000,
		TaskID:     "task-001",
	}

	ok, err := govalidator.ValidateStruct(location)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Building is required"))
}

func TestInvalidAppLocationFloorRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	location := entity.AppLocation{
		Location:   "Laboratory A",
		Building:   "Engineering Building",
		Floor:      0,
		Latitude:   14.882500,
		Longtitude: 102.028000,
		TaskID:     "task-001",
	}

	ok, err := govalidator.ValidateStruct(location)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Floor is required"))
}

func TestInvalidAppLocationLatitudeRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	location := entity.AppLocation{
		Location:   "Laboratory A",
		Building:   "Engineering Building",
		Floor:      3,
		Latitude:   0,
		Longtitude: 102.028000,
		TaskID:     "task-001",
	}

	ok, err := govalidator.ValidateStruct(location)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Latitude is required"))
}

func TestInvalidAppLocationLongtitudeRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	location := entity.AppLocation{
		Location:   "Laboratory A",
		Building:   "Engineering Building",
		Floor:      3,
		Latitude:   14.882500,
		Longtitude: 0,
		TaskID:     "task-001",
	}

	ok, err := govalidator.ValidateStruct(location)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("Longtitude is required"))
}

func TestInvalidAppLocationTaskIDRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	location := entity.AppLocation{
		Location:   "Laboratory A",
		Building:   "Engineering Building",
		Floor:      3,
		Latitude:   14.882500,
		Longtitude: 102.028000,
		TaskID:     "",
	}

	ok, err := govalidator.ValidateStruct(location)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
	g.Expect(err.Error()).To(Equal("TaskID is required"))
}

func TestInvalidAppLocationMultipleFieldsRequired(t *testing.T) {
	g := NewGomegaWithT(t)

	location := entity.AppLocation{
		Location:   "",
		Building:   "",
		Floor:      0,
		Latitude:   0,
		Longtitude: 0,
		TaskID:     "",
	}

	ok, err := govalidator.ValidateStruct(location)
	g.Expect(ok).To(BeFalse())
	g.Expect(err).ToNot(BeNil())
}